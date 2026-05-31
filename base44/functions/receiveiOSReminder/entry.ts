import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // For webhooks, we use service role (no user auth needed)
    const body = await req.json();
    const { title, notes, due_date, priority, list_name, source_url, subtasks } = body;

    // Validate required fields
    if (!title) {
      return Response.json({ 
        status: 'error', 
        error: 'Title is required' 
      }, { status: 400 });
    }

    // Create the main reminder
    const reminder = await base44.asServiceRole.entities.Reminder.create({
      title: title,
      notes: notes || '',
      due_date: due_date || null,
      priority: priority || 'medium',
      status: 'pending',
      type: 'ios_reminder',
      source: 'ios_shortcut',
      list_name: list_name || 'Reminders',
      list_color: '#3b82f6',
      source_url: source_url || '',
      created_by_email: 'system@ios-sync',
    });

    // Parse and create subtasks if provided
    let subtaskCount = 0;
    if (subtasks && Array.isArray(subtasks) && subtasks.length > 0) {
      for (const subtask of subtasks) {
        try {
          await base44.asServiceRole.entities.Reminder.create({
            title: subtask.title || subtask,
            notes: `Parent: ${title}`,
            due_date: due_date || null,
            priority: subtask.priority || priority || 'medium',
            status: subtask.completed ? 'completed' : 'pending',
            type: 'ios_reminder',
            source: 'ios_shortcut',
            list_name: list_name || 'Reminders',
            list_color: '#3b82f6',
            parent_reminder_id: reminder.id,
            created_by_email: 'system@ios-sync',
          });
          subtaskCount++;
        } catch (subtaskError) {
          console.error('Error creating subtask:', subtaskError);
        }
      }
    }

    return Response.json({
      status: 'success',
      reminder_id: reminder.id,
      subtasks_created: subtaskCount,
      message: `Reminder created with ${subtaskCount} subtasks`,
    });

  } catch (error) {
    return Response.json({ 
      status: 'error', 
      error: error.message 
    }, { status: 500 });
  }
});