import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Question } from '../../model';
import { Code2 } from 'lucide-react';
import { Dialog, Button } from '../../../../design-system';
import { getLanguageConfig, SUPPORTED_TECHNICAL_LANGUAGES } from '../../constants/technicalLanguages';

interface Props {
  question: Question;
  code: string;
  language: string;
  onChangeCode: (code: string) => void;
  onChangeLanguage: (lang: string) => void;
  disabled?: boolean;
}

export const TechnicalEditorPanel: React.FC<Props> = ({
  question,
  code,
  language,
  onChangeCode,
  onChangeLanguage,
  disabled,
}) => {
  const allowedLanguages = (
    question.languages?.length
      ? question.languages
      : question.coding?.languageSupport?.length
      ? question.coding.languageSupport
      : ['javascript', 'python', 'java', 'cpp', 'sql']
  ).filter((l) => Boolean(SUPPORTED_TECHNICAL_LANGUAGES[l.toLowerCase()]));

  const [pendingLang, setPendingLang] = useState<string | null>(null);

  const handleLangSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLang = e.target.value;
    if (nextLang === language) return;
    if (code.trim()) {
      setPendingLang(nextLang);
    } else {
      switchLanguage(nextLang);
    }
  };

  const switchLanguage = (targetLang: string) => {
    onChangeLanguage(targetLang);
    setPendingLang(null);
  };

  const currentLangConfig = getLanguageConfig(language);

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shadow-md">
      {/* Action Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/90 border-b border-slate-700/80 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <Code2 className="w-4 h-4 text-blue-400" />
          <span>Code Editor</span>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="language-select" className="text-slate-400 font-medium">
            Language:
          </label>
          <select
            id="language-select"
            value={language}
            onChange={handleLangSelect}
            disabled={disabled || allowedLanguages.length <= 1}
            className="bg-slate-900 text-slate-200 border border-slate-700 rounded px-2.5 py-1 font-mono text-xs focus:outline-none focus:border-blue-500"
          >
            {allowedLanguages.map((langKey) => {
              const cfg = getLanguageConfig(langKey);
              return (
                <option key={langKey} value={langKey}>
                  {cfg.label}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 min-h-[300px] relative">
        <Editor
          height="100%"
          language={currentLangConfig.monacoLanguage}
          value={code}
          onChange={(v) => onChangeCode(v ?? '')}
          options={{
            readOnly: disabled,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'Fira Code, Menlo, Monaco, Consolas, monospace',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            bracketPairColorization: { enabled: true },
          }}
          theme="vs-dark"
        />
      </div>

      {/* Confirmation Dialog when switching language */}
      <Dialog
        open={Boolean(pendingLang)}
        onOpenChange={(open) => !open && setPendingLang(null)}
        title="Switch Programming Language?"
        description="Switching language will replace current unsubmitted code in the editor with starter code for the selected language."
      >
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={() => setPendingLang(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => pendingLang && switchLanguage(pendingLang)}>
            Switch & Reset Code
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
