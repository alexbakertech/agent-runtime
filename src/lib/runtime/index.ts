/**
 * Runtime Module - Agent Execution Engine
 * 
 * Core components for running agentic loops with tools:
 * - RuntimeEngine: Basic execution with streaming
 * - AgentRuntime: Full agentic loop with tool calls
 * - Types: TypeScript definitions for runtime
 * - Spec: Execution specification system
 */

export * from './types';
export * from './assembly';
export { RuntimeEngine } from './engine';
export type { RuntimeEventHandler as EngineEventHandler } from './engine';
export { AgentRuntime } from './agent';
export type { AgentEventHandler, ToolDefinition, ToolCallResult } from './agent';
export * from './spec';
