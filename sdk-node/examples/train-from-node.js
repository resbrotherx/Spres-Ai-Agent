/**
 * Train your Brainbox from Node.js.
 *
 *   npm install https://port.smartpowerbilling.com/sdk/downloads/spres-ai-1.1.0.tgz
 *   export BRAINBOX_SECRET_KEY=sk_live_...   # Staff dashboard -> Settings -> API keys -> Secret
 *   node train-from-node.js handbook.pdf
 *
 * 1. uploads a PDF (or XML/DOCX/TXT...) file,
 * 2. connects a support-tickets API (after a dry-run preview),
 * 3. pushes records from a database loop with trainText,
 * 4. waits until every training task has finished.
 *
 * Use a SECRET key here (server-side only). Never put it in a browser or mobile app.
 */
const fs = require('fs');
const { BrainboxNodeSDK, BrainboxError } = require('spres-ai');

async function main() {
  const sdk = new BrainboxNodeSDK({
    apiUrl: process.env.BRAINBOX_API_URL || 'https://port.smartpowerbilling.com',
    apiKey: process.env.BRAINBOX_SECRET_KEY, // the key decides the tenant
  });
  const taskIds = [];

  // 1) Upload a document
  const pdfPath = process.argv[2] || 'employee-handbook.pdf';
  if (fs.existsSync(pdfPath)) {
    const job = await sdk.trainFile(pdfPath, { name: 'Employee handbook', audience: 'internal' });
    console.log(`Uploaded ${pdfPath}: source ${job.source.source_id}, task ${job.task_id}`);
    taskIds.push(job.task_id);
  } else {
    console.log(`Skipping file upload: ${pdfPath} not found`);
  }

  // 2) Connect a support-tickets API
  if (process.env.HELPDESK_TOKEN) {
    const config = {
      url: 'https://helpdesk.example.com/api/tickets',
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.HELPDESK_TOKEN}` },
      query: { status: 'solved' },
      data_path: 'data.tickets', // where the list of tickets is in the JSON
      source_type: 'support_tickets',
      mapping: { id_field: 'id', question_field: 'subject', answer_field: 'resolution' },
      pagination: { type: 'page', page_param: 'page', max_pages: 10 },
      audience: 'internal',
    };
    const preview = await sdk.testApiSource(config); // dry run: nothing is saved
    console.log(`API preview: ok=${preview.ok} records=${preview.records_found}`);
    if (preview.ok) {
      const job = await sdk.addApiSource({ ...config, name: 'Helpdesk tickets' });
      taskIds.push(job.task_id);
    } else {
      console.log(`Not connecting the API: ${preview.error}`);
    }
  }

  // 3) Push records from your database (replace with your own query: pg, mysql2, prisma...)
  const rows = [
    { id: 1, question: 'How do I reset my meter PIN?', answer: 'Settings > Meter > Reset PIN, then enter the SMS code.', isPublic: true },
    { id: 2, question: 'What is the refund window?', answer: 'Refunds are processed within 14 days.', isPublic: true },
    { id: 3, question: 'Who approves vendor payouts?', answer: 'The finance lead approves payouts above 500.', isPublic: false },
  ];
  for (const row of rows) {
    const job = await sdk.trainText(`Q: ${row.question}\nA: ${row.answer}`, {
      name: `FAQ #${row.id}`,
      audience: row.isPublic ? 'customer' : 'internal',
    });
    taskIds.push(job.task_id);
  }
  console.log(`Queued ${taskIds.length} training task(s)`);

  // 4) Wait for completion
  let failures = 0;
  for (const taskId of taskIds) {
    try {
      const status = await sdk.waitForTask(taskId, { timeout: 600, poll: 3 });
      console.log(`  ${taskId}: ${status.status}`);
    } catch (err) {
      failures += 1;
      console.log(`  ${taskId}: ${err.message}`);
    }
  }
  const { totals } = await sdk.listSources();
  console.log(`Done. ${totals.sources} sources, ${totals.documents} documents in your Brainbox.`);
  process.exitCode = failures ? 1 : 0;
}

main().catch((err) => {
  console.error(err instanceof BrainboxError ? `Brainbox: ${err.message}` : err);
  process.exitCode = 1;
});
