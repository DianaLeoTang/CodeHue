import React, { 
  useState, 
  useEffect, 
  useMemo, 
  useCallback, 
  useRef, 
  useContext, 
  useReducer, 
  useLayoutEffect,
  useImperativeHandle,
  useDebugValue,
  useDeferredValue,
  useTransition,
  useId,
  useSyncExternalStore,
  useInsertionEffect
} from 'react';

/**
 * 扩展测试组件 - 用于验证 CodeHue 的所有 Hooks 颜色配置
 */
export function ExtendedHooksTestComponent() {
  // 测试 useState - 应该显示你配置的 useState 颜色
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  // 测试 useRef - 应该显示你配置的 useRef 颜色
  const inputRef = useRef<HTMLInputElement>(null);
  const countRef = useRef(0);

  // 测试 useContext - 应该显示你配置的 useContext 颜色
  const theme = useContext(React.createContext('light'));

  // 测试 useReducer - 应该显示你配置的 useReducer 颜色
  const [state, dispatch] = useReducer((state: any, action: any) => {
    switch (action.type) {
      case 'increment':
        return { count: state.count + 1 };
      case 'decrement':
        return { count: state.count - 1 };
      default:
        return state;
    }
  }, { count: 0 });

  // 测试 useEffect - 应该显示你配置的 useEffect 颜色
  useEffect(() => {
    console.log('Component mounted');
    return () => {
      console.log('Component unmounted');
    };
  }, []);

  useEffect(() => {
    console.log('Count changed:', count);
  }, [count]);

  useEffect(() => {
    document.title = `Count: ${count}`;
  }, [count]);

  // 测试 useLayoutEffect - 应该显示你配置的 useLayoutEffect 颜色
  useLayoutEffect(() => {
    console.log('Layout effect running');
  }, []);

  // 测试 useInsertionEffect - 应该显示你配置的 useInsertionEffect 颜色
  useInsertionEffect(() => {
    console.log('Insertion effect running');
  }, []);

  // 测试 useMemo - 应该显示你配置的 useMemo 颜色
  const expensiveValue = useMemo(() => {
    console.log('Computing expensive value...');
    return count * 2;
  }, [count]);

  const filteredData = useMemo(() => {
    return Array.from({ length: count }, (_, i) => i);
  }, [count]);

  // 测试 useCallback - 应该显示你配置的 useCallback 颜色
  const handleClick = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);

  const handleReset = useCallback(() => {
    setCount(0);
    setName('');
  }, []);

  const handleToggle = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  // 测试 useImperativeHandle - 应该显示你配置的 useImperativeHandle 颜色
  useImperativeHandle(inputRef, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
  }));

  // 测试 useDebugValue - 应该显示你配置的 useDebugValue 颜色
  useDebugValue(count, count => `Count: ${count}`);

  // 测试 useDeferredValue - 应该显示你配置的 useDeferredValue 颜色
  const deferredCount = useDeferredValue(count);

  // 测试 useTransition - 应该显示你配置的 useTransition 颜色
  const [isPending, startTransition] = useTransition();

  // 测试 useId - 应该显示你配置的 useId 颜色
  const id = useId();

  // 测试 useSyncExternalStore - 应该显示你配置的 useSyncExternalStore 颜色
  const externalValue = useSyncExternalStore(
    () => () => {},
    () => 'external-store-value'
  );

  return (
    <div>
      <h1>Extended Hooks Color Test</h1>
      <p>Count: {count}</p>
      <p>Expensive Value: {expensiveValue}</p>
      <p>Deferred Count: {deferredCount}</p>
      <p>ID: {id}</p>
      <p>External Value: {externalValue}</p>
      <p>Theme: {theme}</p>
      <p>State: {state.count}</p>
      <p>Is Pending: {isPending ? 'Yes' : 'No'}</p>
      
      <input ref={inputRef} placeholder="Test input" />
      
      <button onClick={handleClick}>Increment</button>
      <button onClick={handleReset}>Reset</button>
      <button onClick={handleToggle}>Toggle</button>
      <button onClick={() => dispatch({ type: 'increment' })}>Reducer +</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>Reducer -</button>
      <button onClick={() => startTransition(() => setCount(c => c + 1))}>
        Start Transition
      </button>
    </div>
  );
}
