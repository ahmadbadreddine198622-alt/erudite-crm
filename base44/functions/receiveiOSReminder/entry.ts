import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // For webhooks, we use service role (no user auth needed)
    const body = await req.json();
    const { title, notes, due_date, priority, list_name, source_url } = body;

    // Validate required fields
    if (!title) {
      return Response.json({ 
        status: 'error', 
        error: 'Title is required' 
      }, { status: 400 });
    }

    // Create the reminder
    const reminder = await base44.asServiceRole.entities.Reminder.create({
      title: title,
      notes: notes || '',
      due_date: due_date || null,
      priority: priority || 'medium',
      status: 'pending',
      type: 'ios_reminder',
      source: 'ios_shortcut',
      ios_list_name: list_name || 'Reminders',
      ios_source_url: source_url || '',
      created_by_email: 'system@ios-sync',
    });

    return Response.json({
      status: 'success',
      reminder_id: reminder.id,
      message: 'Reminder created successfully',
    });

  } catch (error) {
    return Response.json({ 
      status: 'error', 
      error: error.message 
    }, { status: 500 });
  }
});