import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { AppError } from '../shared/errors/AppError.js';

/**
 * Deep equality helper for normalizing returned values vs expected outputs.
 */
function isDeepEqual(actual, expected) {
  if (actual === expected) return true;
  if (typeof actual !== typeof expected) return false;
  if (actual === null || expected === null) return actual === expected;

  if (typeof actual === 'number' && typeof expected === 'number') {
    if (isNaN(actual) && isNaN(expected)) return true;
    return Math.abs(actual - expected) < 1e-7;
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < actual.length; i++) {
      if (!isDeepEqual(actual[i], expected[i])) return false;
    }
    return true;
  }

  if (typeof actual === 'object' && typeof expected === 'object') {
    const keysA = Object.keys(actual);
    const keysB = Object.keys(expected);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(expected, key)) return false;
      if (!isDeepEqual(actual[key], expected[key])) return false;
    }
    return true;
  }

  return String(actual).trim() === String(expected).trim();
}

/**
 * Normalize input value to array of parameters for function invocation
 */
function parseFunctionArgs(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
      return [parsed];
    } catch {
      return [input];
    }
  }
  if (input !== undefined && input !== null) {
    return [input];
  }
  return [];
}

/**
 * Executes JavaScript candidate code safely using Node.js vm
 */
function executeJavaScriptLocal({ code, functionName, executionMode = 'function', testCases = [], timeLimitMs = 2000 }) {
  const results = [];
  let compileError = null;

  // Validate syntax first
  let script;
  try {
    script = new vm.Script(code, { filename: 'candidate_code.js' });
  } catch (err) {
    compileError = err.message || 'Syntax Error';
    return {
      status: 'compile_error',
      passedTests: 0,
      totalTests: testCases.length,
      executionTimeMs: 0,
      error: compileError,
      testResults: testCases.map((tc) => ({
        passed: false,
        weight: tc.weight || 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: compileError,
        status: 'Compile Error',
        time: 0,
        memory: 0,
        error: compileError,
      })),
    };
  }

  let overallTime = 0;
  let hasTimeout = false;
  let hasRuntimeError = false;

  for (const tc of testCases) {
    const startTime = Date.now();
    const sandboxConsole = [];
    const sandbox = {
      console: {
        log: (...args) => sandboxConsole.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
        error: (...args) => sandboxConsole.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
      },
      JSON,
      Math,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Date,
      RegExp,
      Map,
      Set,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
    };

    const context = vm.createContext(sandbox);

    try {
      script.runInContext(context, { timeout: timeLimitMs });

      let actualOutput;
      let fnName = functionName || 'solution';
      if (['stdout', 'stdin-stdout', 'stdin', 'full-program'].includes(executionMode)) {
        actualOutput = sandboxConsole.join('\n').trim();
      } else {
        let fn = context[fnName];
        if (typeof fn !== 'function') {
          // Attempt to detect declared function name from candidate code
          const fnMatch = code.match(/function\s+([a-zA-Z0-9_$]+)/) || code.match(/(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:function|\([^)]*\)\s*=>)/);
          if (fnMatch && typeof context[fnMatch[1]] === 'function') {
            fn = context[fnMatch[1]];
            fnName = fnMatch[1];
          }
        }
        if (typeof fn !== 'function') {
          const userFnKey = Object.keys(sandbox).find((k) => typeof sandbox[k] === 'function' && !['console', 'JSON', 'Math', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp', 'Map', 'Set', 'parseInt', 'parseFloat', 'isNaN', 'isFinite'].includes(k));
          if (userFnKey) {
            fn = sandbox[userFnKey];
            fnName = userFnKey;
          } else {
            throw new Error(`Function "${fnName}" is not defined.`);
          }
        }
        const args = parseFunctionArgs(tc.input);
        actualOutput = fn(...args);
      }

      const elapsed = Date.now() - startTime;
      overallTime += elapsed;

      let expectedOutput = tc.expectedOutput;
      if (typeof expectedOutput === 'string') {
        try {
          expectedOutput = JSON.parse(expectedOutput);
        } catch {
          // Keep as raw string if not valid JSON
        }
      }

      const passed = isDeepEqual(actualOutput, expectedOutput);

      results.push({
        passed,
        weight: tc.weight || 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: typeof actualOutput === 'object' ? JSON.stringify(actualOutput) : String(actualOutput ?? ''),
        status: passed ? 'Accepted' : 'Wrong Answer',
        time: elapsed,
        memory: 1024,
      });
    } catch (err) {
      const elapsed = Date.now() - startTime;
      overallTime += elapsed;
      const isTimeout = err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' || err.message?.includes('timed out');
      if (isTimeout) hasTimeout = true;
      else hasRuntimeError = true;

      results.push({
        passed: false,
        weight: tc.weight || 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: isTimeout ? 'Time Limit Exceeded' : err.message || 'Runtime Error',
        status: isTimeout ? 'Time Limit Exceeded' : 'Runtime Error',
        time: elapsed,
        memory: 1024,
        error: err.message,
      });
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  let status = 'completed';
  if (hasTimeout) status = 'timeout';
  else if (hasRuntimeError && passedCount === 0) status = 'runtime_error';

  return {
    status,
    passedTests: passedCount,
    totalTests: testCases.length,
    executionTimeMs: overallTime,
    testResults: results,
  };
}

/**
 * Executes Python candidate code locally using system python
 */
function executePythonLocal({ code, functionName, executionMode = 'function', testCases = [], timeLimitMs = 2000 }) {
  // Check if python is available
  const opts = { encoding: 'utf8', timeout: 500, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] };
  let pyCheck = { status: -1 };
  let py3Check = { status: -1 };
  try { pyCheck = spawnSync('python', ['-c', 'print(1)'], opts); } catch { /* ignore */ }
  try { py3Check = spawnSync('python3', ['-c', 'print(1)'], opts); } catch { /* ignore */ }
  const pyCmd = (pyCheck.status === 0 && pyCheck.stdout?.trim() === '1') ? 'python' : (py3Check.status === 0 && py3Check.stdout?.trim() === '1') ? 'python3' : null;

  if (!pyCmd) {
    // Fallback if no local python binary installed
    return executeJavaScriptLocal({ code, functionName, executionMode, testCases, timeLimitMs });
  }

  const fnName = functionName || 'solution';
  const runnerScript = `
import sys
import json

${code}

def is_deep_equal(a, b):
    if a == b: return True
    if type(a) != type(b): return False
    if isinstance(a, list):
        if len(a) != len(b): return False
        return all(is_deep_equal(x, y) for x, y in zip(a, b))
    if isinstance(a, dict):
        if set(a.keys()) != set(b.keys()): return False
        return all(is_deep_equal(a[k], b[k]) for k in a)
    return False

test_cases = json.loads(sys.stdin.read())
results = []

for tc in test_cases:
    tc_input = tc.get('input')
    expected = tc.get('expectedOutput')
    if isinstance(expected, str):
        try: expected = json.loads(expected)
        except: pass

    try:
        if '${executionMode}' in ('stdout', 'stdin-stdout', 'stdin', 'full-program'):
            import io
            buf = io.StringIO()
            sys.stdout = buf
            exec(code)
            sys.stdout = sys.__stdout__
            actual = buf.getvalue().strip()
        else:
            args = tc_input if isinstance(tc_input, list) else [tc_input] if tc_input is not None else []
            fn = globals().get('${fnName}')
            if not callable(fn):
                user_fns = [v for k, v in list(globals().items()) if callable(v) and not k.startswith('_') and k not in ('is_deep_equal', 'json', 'sys', 'io', 're', 'os', 'math')]
                if user_fns:
                    fn = user_fns[0]
                else:
                    raise Exception(f"Function '${fnName}' is not defined")
            actual = fn(*args)

        passed = is_deep_equal(actual, expected)
        results.append({
            'passed': passed,
            'status': 'Accepted' if passed else 'Wrong Answer',
            'actualOutput': json.dumps(actual) if isinstance(actual, (dict, list)) else str(actual),
            'expectedOutput': str(expected),
            'input': tc_input,
            'time': 10
        })
    except Exception as e:
        results.append({
            'passed': False,
            'status': 'Runtime Error',
            'actualOutput': str(e),
            'expectedOutput': str(expected),
            'input': tc_input,
            'error': str(e),
            'time': 10
        })

print(json.dumps(results))
`;

  try {
    const res = spawnSync(pyCmd, ['-c', runnerScript], {
      input: JSON.stringify(testCases),
      encoding: 'utf8',
      timeout: timeLimitMs * testCases.length,
    });

    if (res.error && res.error.code === 'ETIMEDOUT') {
      return {
        status: 'timeout',
        passedTests: 0,
        totalTests: testCases.length,
        executionTimeMs: timeLimitMs * testCases.length,
        testResults: testCases.map((tc) => ({
          passed: false,
          status: 'Time Limit Exceeded',
          actualOutput: 'Time Limit Exceeded',
          expectedOutput: String(tc.expectedOutput),
          time: timeLimitMs,
        })),
      };
    }

    if (res.status !== 0) {
      const errMsg = res.stderr || 'Python syntax/runtime error';
      return {
        status: 'compile_error',
        passedTests: 0,
        totalTests: testCases.length,
        executionTimeMs: 0,
        error: errMsg,
        testResults: testCases.map((tc) => ({
          passed: false,
          status: 'Compile Error',
          actualOutput: errMsg,
          expectedOutput: String(tc.expectedOutput),
          time: 0,
          error: errMsg,
        })),
      };
    }

    const testResults = JSON.parse(res.stdout || '[]');
    const passedCount = testResults.filter((r) => r.passed).length;
    return {
      status: 'completed',
      passedTests: passedCount,
      totalTests: testCases.length,
      executionTimeMs: testResults.reduce((sum, r) => sum + (r.time || 0), 0),
      testResults,
    };
  } catch (err) {
    return {
      status: 'runtime_error',
      passedTests: 0,
      totalTests: testCases.length,
      executionTimeMs: 0,
      error: err.message,
      testResults: testCases.map((tc) => ({
        passed: false,
        status: 'Runtime Error',
        actualOutput: err.message,
        expectedOutput: String(tc.expectedOutput),
        time: 0,
      })),
    };
  }
}

/**
 * Main entry point for local code execution
 */
export function executeLocalHarness({ code, language, functionName = 'solution', executionMode = 'function', testCases = [], limits = {} }) {
  const timeLimitMs = Math.round((limits.timeLimit || 2.0) * 1000);
  const lang = (language || 'javascript').toLowerCase();

  if (lang === 'python') {
    return executePythonLocal({ code, functionName, executionMode, testCases, timeLimitMs });
  }

  // Default for javascript / typescript / others
  return executeJavaScriptLocal({ code, functionName, executionMode, testCases, timeLimitMs });
}
