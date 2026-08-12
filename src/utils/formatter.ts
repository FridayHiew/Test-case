import { Feature, TestResult, TestCase } from '../types';

export function formatResultToMarkdown(feature: Feature, result: TestResult, userInput: string): string {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let markdown = `# Feature Test Specification: ${feature.name}\n\n`;

  // 1. Metadata Section
  markdown += `> **Document Metadata**\n`;
  markdown += `> - **Feature ID**: \`${feature.id}\`\n`;
  markdown += `> - **Feature Version**: \`v${feature.version}\`\n`;
  markdown += `> - **Generated At**: ${currentDate}\n`;
  markdown += `> - **Test Demand**: "${userInput || 'Default Full Coverage'}"\n\n`;

  // 2. Feature Specification Summary
  markdown += `## 1. Feature Specification Overview\n\n`;
  markdown += `**Description**:\n${feature.description}\n\n`;

  if (feature.input_fields.length > 0) {
    markdown += `### 1.1 Input Field Constraints\n\n`;
    markdown += `| Field Name | Type | Required | Format / Constraints |\n`;
    markdown += `| :--- | :--- | :--- | :--- |\n`;
    feature.input_fields.forEach((field) => {
      let constraints = [];
      if (field.format) constraints.push(`Format: ${field.format}`);
      if (field.min !== undefined) constraints.push(`Min: ${field.min}`);
      if (field.max !== undefined) constraints.push(`Max: ${field.max}`);
      const constraintStr = constraints.join(', ') || 'None';
      markdown += `| \`${field.name}\` | \`${field.type}\` | ${field.required ? '✅ Yes' : '❌ No'} | ${constraintStr} |\n`;
    });
    markdown += `\n`;
  }

  if (feature.business_rules.length > 0) {
    markdown += `### 1.2 Business Rules\n\n`;
    feature.business_rules.forEach((rule, idx) => {
      markdown += `${idx + 1}. ${rule}\n`;
    });
    markdown += `\n`;
  }

  // 3. Coverage Summary
  markdown += `## 2. Coverage Summary\n\n`;
  markdown += `This test suite covers and validates the following rule dimensions:\n\n`;
  result.coverage.forEach((item) => {
    markdown += `- [x] ${item}\n`;
  });
  markdown += `\n`;

  // 4. Test Case Matrix Table
  markdown += `## 3. Test Case Matrix\n\n`;
  markdown += `| Case ID | Title | Type | Expected Result |\n`;
  markdown += `| :--- | :--- | :--- | :--- |\n`;
  result.test_cases.forEach((tc) => {
    const typeMap: Record<string, string> = {
      positive: '🟢 Positive Test',
      negative: '🔴 Negative Test',
      boundary: '🟡 Boundary Check',
      security: '🔒 Security Audit',
      performance: '⚡ Performance Load',
    };
    const displayType = typeMap[tc.type] || tc.type;
    markdown += `| \`${tc.id}\` | ${tc.title} | ${displayType} | ${tc.expected} |\n`;
  });
  markdown += `\n`;

  // 5. Test Case Details
  markdown += `## 4. Test Case Details\n\n`;
  result.test_cases.forEach((tc) => {
    const typeMap: Record<string, string> = {
      positive: 'Positive Test',
      negative: 'Negative Test',
      boundary: 'Boundary Check',
      security: 'Security Audit',
      performance: 'Performance Load',
    };
    markdown += `---\n\n`;
    markdown += `### [${tc.id}] ${tc.title}\n\n`;
    markdown += `- **Test Type**: ${typeMap[tc.type] || tc.type}\n`;
    
    if (tc.preconditions.length > 0) {
      markdown += `- **Preconditions**:\n`;
      tc.preconditions.forEach((pre) => {
        markdown += `  - ${pre}\n`;
      });
    } else {
      markdown += `- **Preconditions**: None\n`;
    }

    markdown += `- **Test Steps**:\n`;
    tc.steps.forEach((step, idx) => {
      markdown += `  ${idx + 1}. ${step}\n`;
    });

    markdown += `- **Expected Result**:\n`;
    markdown += `  👉 **${tc.expected}**\n\n`;
  });

  return markdown;
}
