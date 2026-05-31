import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Test payload matching the "CEO AHMAD PROGRESS" reminder
    const testPayload = {
      title: "CEO AHMAD PROGRESS",
      notes: "Task to be completed immediately",
      due_date: new Date().toISOString(),
      priority: "urgent",
      list_name: "CEO AHMAD PROGRESS",
      subtasks: [
        { title: "Add 2 leads to the CRM", priority: "urgent", completed: false },
        { title: "Plan & price Binghatti Phantom 3002 and Damac Paramount for Amina (VIP client)", priority: "urgent", completed: false },
        { title: "Arrange bank evaluation with Amina", priority: "urgent", completed: false },
        { title: "Get Steve's listing and post online", priority: "urgent", completed: false },
        { title: "Call P4 — no matter what", priority: "high", completed: false },
        { title: "Write down goals, plan and vision for the future", priority: "high", completed: false },
        { title: "Call Sixcens and get the stock to the company", priority: "high", completed: false },
        { title: "Send 10 numbers to Marina", priority: "high", completed: false },
        { title: "Get update on NOC for Binghatti", priority: "high", completed: false },
        { title: "Follow up with Italian landlord on status & moving out awareness", priority: "high", completed: false },
        { title: "Follow up with Mohammed Egypt — buying or not?", priority: "high", completed: false },
      ]
    };

    // Call the receiveiOSReminder function
    const response = await base44.functions.invoke('receiveiOSReminder', testPayload);

    return Response.json({
      status: 'test_sent',
      response: response.data,
      payload_sent: testPayload,
    });

  } catch (error) {
    return Response.json({ 
      status: 'error', 
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});