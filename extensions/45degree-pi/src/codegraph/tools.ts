import type {InlineExtension} from "@earendil-works/pi-coding-agent";
import {callersParameters, calleesParameters, exploreParameters, impactParameters} from "./tool-schemas.ts";
import type {CodeGraphService} from "./service.ts";

const NOT_INITIALIZED = "CodeGraph is not initialized for this project. Use /codegraph-init first.";

type GraphNode = {
  id: string;
  kind: string;
  name: string;
  filePath: string;
  startLine: number;
};

function text(value: string) {
  return {content: [{type: "text" as const, text: value}], details: undefined};
}

function formatNodes(nodes: Iterable<GraphNode>, limit: number): string {
  const lines = Array.from(nodes)
    .slice(0, limit)
    .map((node) => `${node.kind} ${node.name} - ${node.filePath}:${node.startLine}`);
  return lines.length ? lines.join("\n") : "No matching symbols found.";
}

function findSymbol(graph: {getNodesByName(symbol: string): GraphNode[]}, symbol: string): GraphNode | undefined {
  return graph.getNodesByName(symbol)[0];
}

export const createCodeGraphExtension =
  (service: CodeGraphService, cwd: string): InlineExtension =>
  (pi) => {
    pi.registerTool({
      name: "codegraph_explore",
      label: "CodeGraph Explore",
      description: "Find relevant code and relationships from the native CodeGraph index.",
      parameters: exploreParameters,
      async execute(_toolCallId, params) {
        const graph = await service.get(cwd);
        if (!graph) return text(NOT_INITIALIZED);
        const result = await graph.findRelevantContext(params.query);
        return text(formatNodes(result.nodes.values(), params.limit ?? 20));
      }
    });

    const registerRelations = (name: "codegraph_callers" | "codegraph_callees", label: string, parameters: typeof callersParameters | typeof calleesParameters, relation: "getCallers" | "getCallees") => {
      pi.registerTool({
        name,
        label,
        description: `List ${relation === "getCallers" ? "callers" : "callees"} of a symbol from the native CodeGraph index.`,
        parameters,
        async execute(_toolCallId, params) {
          const graph = await service.get(cwd);
          if (!graph) return text(NOT_INITIALIZED);
          const node = findSymbol(graph, params.symbol);
          if (!node) return text(`Symbol "${params.symbol}" not found in the codebase.`);
          return text(
            formatNodes(
              graph[relation](node.id).map(({node: related}) => related),
              params.limit ?? 20
            )
          );
        }
      });
    };

    registerRelations("codegraph_callers", "CodeGraph Callers", callersParameters, "getCallers");
    registerRelations("codegraph_callees", "CodeGraph Callees", calleesParameters, "getCallees");

    pi.registerTool({
      name: "codegraph_impact",
      label: "CodeGraph Impact",
      description: "List code potentially affected by changing a symbol.",
      parameters: impactParameters,
      async execute(_toolCallId, params) {
        const graph = await service.get(cwd);
        if (!graph) return text(NOT_INITIALIZED);
        const node = findSymbol(graph, params.symbol);
        if (!node) return text(`Symbol "${params.symbol}" not found in the codebase.`);
        const result = graph.getImpactRadius(node.id, params.depth ?? 2);
        return text(formatNodes(result.nodes.values(), params.limit ?? 20));
      }
    });
  };
