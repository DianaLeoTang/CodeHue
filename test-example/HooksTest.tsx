import React, { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * 测试组件 - 用于验证 CodeHue 的 Hooks 颜色配置
 */
export function HooksTestComponent() {
  // 测试 useState - 应该显示你配置的 useState 颜色
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  const [isVisible, setIsVisible] = useState(false);

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


  //#region 开始
  const a=()=>{
    console.log(1)
  }
  const b=()=>{
    console.log(2)
  }
  //#endregion

  return (
    <div>
      <h1>Hooks Color Test</h1>
      <p>Count: {count}</p>
      <p>Expensive Value: {expensiveValue}</p>
      <button onClick={handleClick}>Increment</button>
      <button onClick={handleReset}>Reset</button>
      <button onClick={handleToggle}>Toggle</button>
    </div>
  );
}

