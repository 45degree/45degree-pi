import {Type} from "typebox";

// Shared TypeBox parameter schemas for the tasks / tasks_query tools,
// kept separate from the tool registration code.

export const tasksParameters = Type.Object({agent: Type.Optional(Type.String()), title: Type.Optional(Type.String()), task: Type.Optional(Type.String()), async: Type.Optional(Type.Boolean()), task_id: Type.Optional(Type.String())});
export const tasksQueryParameters = Type.Object({action: Type.Union([Type.Literal("status"), Type.Literal("result"), Type.Literal("session")]), task_id: Type.String()});
export const tasksCancelParameters = Type.Object({task_id: Type.String()});
