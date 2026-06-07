import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Allow webhook calls (no user auth needed for background processing)
    const { conversation_id, message_id, audio_url, from_number } = await req.json();
    
    if (!message_id || !audio_url) {
      return Response.json({ error: 'message_id and audio_url required' }, { status: 400 });
    }

    // Download audio from WhatsApp
    const audioResponse = await fetch(audio_url, {
      headers: { 'Authorization': `Bearer ${Deno.env.get('WHATSAPP_ACCESS_TOKEN')}` }
    });
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg' });

    // Transcribe using OpenAI Whisper
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
      body: formData
    });

    if (!whisperResponse.ok) {
      throw new Error(`Whisper error: ${whisperResponse.statusText}`);
    }

    const { text: transcription } = await whisperResponse.json();

    // Detect language using Base44 LLM
    const detectResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Detect the language of this text and respond ONLY with the ISO 639-1 language code (e.g., ru, en, ar, es). Text: "${transcription}"`,
    });

    const detected_language = detectResponse.trim().toLowerCase();

    // Translate to English if not already
    let translations = { en: transcription };

    if (detected_language !== 'en') {
      const translateResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate this ${detected_language} text to English. Keep the original meaning, tone, and informal speech. Text: "${transcription}"`,
      });
      translations[detected_language] = transcription;
      translations.en = translateResponse;
    }

    // Update WhatsAppMessage with transcription
    await base44.asServiceRole.entities.WhatsAppMessage.update(message_id, {
      body: `🎤 ${transcription}`,
      transcription: transcription,
      detected_language: detected_language,
      translations: translations
    });

    // Update conversation summary
    await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, {
      last_message: `🎤 Voice message: ${transcription.substring(0, 50)}...`,
    });

    return Response.json({
      success: true,
      transcription,
      detected_language,
      translations
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});