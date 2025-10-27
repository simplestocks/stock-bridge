const { Octokit } = require("@octokit/rest");

exports.handler = async (event) => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const data = JSON.parse(event.body);
    
    // Initialize GitHub API client
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    const owner = "simplestocks";
    const repo = "stock-bridge";
    const path = "survey-responses.csv";
    
    // Format the data as CSV row
    const csvRow = `"${data.timestamp}","${escapeCSV(data.q1)}","${escapeCSV(data.q2)}","${escapeCSV(data.q3)}","${escapeCSV(data.q4)}","${escapeCSV(data.q5)}","${escapeCSV(data.q6)}","${escapeCSV(data.q7)}"`;
    
    let fileContent;
    let fileSha;
    
    try {
      // Try to get existing file
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path
      });
      
      // Decode existing content
      const existingContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
      fileContent = existingContent + '\n' + csvRow;
      fileSha = fileData.sha;
      
    } catch (error) {
      // File doesn't exist, create it with headers
      const headers = '"Timestamp","Q1: Fast trades comfort","Q2: Holding trades comfort","Q3: Session value","Q4: Current pace fit","Q5: Ideal trade duration","Q6: Themed sessions","Q7: Comments"';
      fileContent = headers + '\n' + csvRow;
      fileSha = null;
    }
    
    // Create or update file
    const updateParams = {
      owner,
      repo,
      path,
      message: `New survey response: ${new Date().toISOString()}`,
      content: Buffer.from(fileContent).toString('base64'),
      committer: {
        name: 'Survey Bot',
        email: 'survey@simplestocks.com'
      }
    };
    
    if (fileSha) {
      updateParams.sha = fileSha;
    }
    
    await octokit.repos.createOrUpdateFileContents(updateParams);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ success: true, message: "Response saved" })
    };
    
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: "Failed to save response", details: error.message })
    };
  }
};

// Helper function to escape CSV values
function escapeCSV(value) {
  if (!value) return '';
  return String(value).replace(/"/g, '""');
}
