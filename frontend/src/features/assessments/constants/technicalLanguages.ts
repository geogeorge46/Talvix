export interface LanguageConfig {
  id: string;
  label: string;
  monacoLanguage: string;
  fileExtension: string;
  starterTemplate: string;
}

export const SUPPORTED_TECHNICAL_LANGUAGES: Record<string, LanguageConfig> = {
  javascript: {
    id: 'javascript',
    label: 'JavaScript',
    monacoLanguage: 'javascript',
    fileExtension: '.js',
    starterTemplate: 'function solution(input) {\n  // Write your code here\n  return input;\n}\n',
  },
  python: {
    id: 'python',
    label: 'Python 3',
    monacoLanguage: 'python',
    fileExtension: '.py',
    starterTemplate: 'def solution(input):\n    # Write your code here\n    return input\n',
  },
  java: {
    id: 'java',
    label: 'Java',
    monacoLanguage: 'java',
    fileExtension: '.java',
    starterTemplate: 'public class Main {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}\n',
  },
  cpp: {
    id: 'cpp',
    label: 'C++',
    monacoLanguage: 'cpp',
    fileExtension: '.cpp',
    starterTemplate: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}\n',
  },
  c: {
    id: 'c',
    label: 'C',
    monacoLanguage: 'c',
    fileExtension: '.c',
    starterTemplate: '#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}\n',
  },
  go: {
    id: 'go',
    label: 'Go',
    monacoLanguage: 'go',
    fileExtension: '.go',
    starterTemplate: 'package main\nimport "fmt"\n\nfunc main() {\n    // Write your code here\n}\n',
  },
  rust: {
    id: 'rust',
    label: 'Rust',
    monacoLanguage: 'rust',
    fileExtension: '.rs',
    starterTemplate: 'fn main() {\n    // Write your code here\n}\n',
  },
  csharp: {
    id: 'csharp',
    label: 'C#',
    monacoLanguage: 'csharp',
    fileExtension: '.cs',
    starterTemplate: 'using System;\n\nclass Program {\n    static void Main(string[] args) {\n        // Write your code here\n    }\n}\n',
  },
  php: {
    id: 'php',
    label: 'PHP',
    monacoLanguage: 'php',
    fileExtension: '.php',
    starterTemplate: '<?php\n// Write your code here\n',
  },
  sql: {
    id: 'sql',
    label: 'SQL',
    monacoLanguage: 'sql',
    fileExtension: '.sql',
    starterTemplate: '-- Write your SQL query here\nSELECT * FROM table_name;\n',
  },
};

export const getLanguageConfig = (langId: string): LanguageConfig => {
  const normalized = (langId || 'javascript').toLowerCase();
  return SUPPORTED_TECHNICAL_LANGUAGES[normalized] ?? SUPPORTED_TECHNICAL_LANGUAGES.javascript;
};
