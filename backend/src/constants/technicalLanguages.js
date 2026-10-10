export const SUPPORTED_TECHNICAL_LANGUAGES = Object.freeze({
  javascript: {
    id: 'javascript',
    label: 'JavaScript (Node.js)',
    monacoLanguage: 'javascript',
    executionLanguage: 'javascript',
    fileExtension: '.js',
    starterTemplate: 'function solution(input) {\n  // Write your code here\n  return input;\n}\n',
  },
  python: {
    id: 'python',
    label: 'Python 3',
    monacoLanguage: 'python',
    executionLanguage: 'python',
    fileExtension: '.py',
    starterTemplate: 'def solution(input):\n    # Write your code here\n    return input\n',
  },
  java: {
    id: 'java',
    label: 'Java',
    monacoLanguage: 'java',
    executionLanguage: 'java',
    fileExtension: '.java',
    starterTemplate: 'public class Main {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}\n',
  },
  cpp: {
    id: 'cpp',
    label: 'C++',
    monacoLanguage: 'cpp',
    executionLanguage: 'cpp',
    fileExtension: '.cpp',
    starterTemplate: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}\n',
  },
  c: {
    id: 'c',
    label: 'C',
    monacoLanguage: 'c',
    executionLanguage: 'c',
    fileExtension: '.c',
    starterTemplate: '#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}\n',
  },
  go: {
    id: 'go',
    label: 'Go',
    monacoLanguage: 'go',
    executionLanguage: 'go',
    fileExtension: '.go',
    starterTemplate: 'package main\nimport "fmt"\n\nfunc main() {\n    // Write your code here\n}\n',
  },
  rust: {
    id: 'rust',
    label: 'Rust',
    monacoLanguage: 'rust',
    executionLanguage: 'rust',
    fileExtension: '.rs',
    starterTemplate: 'fn main() {\n    // Write your code here\n}\n',
  },
  csharp: {
    id: 'csharp',
    label: 'C#',
    monacoLanguage: 'csharp',
    executionLanguage: 'csharp',
    fileExtension: '.cs',
    starterTemplate: 'using System;\n\nclass Program {\n    static void Main(string[] args) {\n        // Write your code here\n    }\n}\n',
  },
  php: {
    id: 'php',
    label: 'PHP',
    monacoLanguage: 'php',
    executionLanguage: 'php',
    fileExtension: '.php',
    starterTemplate: '<?php\n// Write your code here\n',
  },
  sql: {
    id: 'sql',
    label: 'SQL',
    monacoLanguage: 'sql',
    executionLanguage: 'sql',
    fileExtension: '.sql',
    starterTemplate: '-- Write your SQL query here\nSELECT * FROM table_name;\n',
  },
});

export const getLanguageConfig = (langId) => {
  const normalized = (langId || 'javascript').toLowerCase();
  return SUPPORTED_TECHNICAL_LANGUAGES[normalized] || SUPPORTED_TECHNICAL_LANGUAGES.javascript;
};
