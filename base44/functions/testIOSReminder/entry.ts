import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Test payload matching the "CEO AHMAD PROGRESS" reminder
    const parentTitle = "Hi Ahmad, I'm very successful and very happy task";
    const now = new Date().toISOString();

    // Create parent reminder
    const parent = await base44.asServiceRole.entities.Reminder.create({
      title: parentTitle,
      notes: "Test reminder from iOS sync",
      due_date: now,
      priority: "urgent",
      list_name: "Test List",
      status: "pending",
      source: "ios_shortcut",
      created_by: user.email,
    });

    // Create subtasks
    const subtasks = [
      "Add 2 leads to the CRM",
      "Plan & price Binghatti Phantom 3002 and Damac Paramount for Amina (VIP client)",
      "Arrange bank evaluation with Amina",
      "Get Steve's listing and post online",
      "Call P4 — no matter what",
      "Write down goals, plan and vision for the future",
      "Call Sixcens and get the stock to the company",
      "Send 10 numbers to Marina",
      "Get update on NOC for Binghatti",
      "Follow up with Italian landlord on status & moving out awareness",
      "Follow up with Mohammed Egypt — buying or not?",
    ];

    const createdSubtasks = [];
    for (const subtaskTitle of subtasks) {
      const subtask = await base44.asServiceRole.entities.Reminder.create({
        title: subtaskTitle,
        notes: "Subtask",
        priority: "high",
        status: "pending",
        source: "ios_shortcut",
        parent_reminder_id: parent.id,
        list_name: "Test List",
        created_by: user.email,
      });
      createdSubtasks.push(subtask.id);
    }

    return Response.json({
      status: 'success',
      parent_id: parent.id,
      parent_title: parentTitle,
      subtasks_created: createdSubtasks.length,
      message: 'Test reminder with 11 subtasks created successfully',
    });

  } catch (error) {
    return Response.json({ 
      status: 'error', 
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});