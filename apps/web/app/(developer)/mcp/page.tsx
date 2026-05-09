"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Wifi } from "lucide-react";
import { Button } from "@novacal/ui/button";
import { Badge } from "@novacal/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@novacal/ui/tooltip";
import { CodeBlockCopy } from "../../../../components/CodeBlockCopy";
import { cn } from "@novacal/ui/lib/utils";

// ─── Self-documenting MCP config ───

function generateMcpJson(instanceUrl: string, apiKey: string) {
  return {
    mcpServers: {
      novacal: {
        url: `${instanceUrl}/mcp/sse`,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    },
  };
}

// ─── Component ───

export default function McpPage() {
  const [instanceUrl, setInstanceUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [activeConnections, setActiveConnections] = useState(0);
  const [urlCopied, setUrlCopied] = useState(false);

  /** Derive instance URL from window location. */
  useEffect(() => {
    const origin = window.location.origin;
    setInstanceUrl(origin);
  }, []);

  /** Fetch active SSE connection count. */
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/v1/mcp/status");
        const data = await res.json();
        setActiveConnections(data.activeConnections ?? 0);
      } catch {
        // Fallback
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  /** Fetch or generate an MCP API key. */
  useEffect(() => {
    const fetchKey = async () => {
      try {
        const res = await fetch("/api/v1/mcp/key");
        const data = await res.json();
        setApiKey(data.apiKey ?? "");
      } catch {
        setApiKey("mcp_key_placeholder");
      }
    };
    fetchKey();
  }, []);

  const mcpJson = generateMcpJson(instanceUrl, apiKey);
  const mcpJsonString = JSON.stringify(mcpJson, null, 2);

  /** Copy the SSE connection URL. */
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(`${instanceUrl}/mcp/sse`);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      // Clipboard might not be available
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-xl font-semibold text-[--text-primary]">MCP Configuration</h1>
        <p className="mt-0.5 text-xs text-[--text-secondary]">
          Connect Cursor, Claude Code, and other AI agents to NovaCal via the Model Context Protocol.
        </p>
      </div>

      {/* Active connections badge */}
      <div className="flex items-center gap-3">
        <Badge
          variant="secondary"
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 font-mono text-xs",
            activeConnections > 0
              ? "bg-[--success]/10 text-[--success]"
              : "text-[--text-muted]",
          )}
        >
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              activeConnections > 0 ? "bg-[--success]" : "bg-[--text-muted]",
            )}
          />
          {activeConnections} active SSE connection{activeConnections !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Connection string */}
      <div className="space-y-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
          SSE Endpoint
        </h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-[--radius-base] border border-[--border-subtle] bg-[--background] px-3 py-2 font-mono text-xs text-[--text-primary] select-all">
            {instanceUrl}/mcp/sse
          </code>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="flex items-center gap-1 rounded-[--radius-base] border border-[--border-subtle] px-2.5 py-2 text-xs text-[--text-secondary] transition-none hover:bg-[--ghost-hover] hover:text-[--text-primary]"
                >
                  <motion.span
                    key={urlCopied ? "check" : "copy"}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {urlCopied ? <Check size={14} /> : <Copy size={14} />}
                  </motion.span>
                  <span>{urlCopied ? "Copied" : "Copy"}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Copy SSE endpoint URL</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* mcp.json payload */}
      <div className="space-y-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
          Agent Config (mcp.json)
        </h2>
        <p className="text-xs text-[--text-secondary]">
          Add this block to your AI agent&apos;s MCP configuration file.
        </p>
        <CodeBlockCopy
          code={mcpJsonString}
          language="json"
        />
      </div>

      {/* Instructions for Cursor / Claude */}
      <div className="space-y-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
          Setup Instructions
        </h2>
        <div className="space-y-2 rounded-[--radius-base] border border-[--border-subtle] bg-[--surface-elevated] p-4 font-mono text-xs leading-relaxed text-[--text-secondary]">
          <p><span className="text-[--primary-accent]"># Cursor</span></p>
          <p>Add the JSON above to <span className="text-[--text-primary]">.cursor/mcp.json</span></p>
          <p className="mt-2"><span className="text-[--primary-accent]"># Claude Code</span></p>
          <p>Run: <span className="text-[--text-primary]">claude mcp add novacal -s {instanceUrl}/mcp/sse</span></p>
          <p className="mt-2"><span className="text-[--primary-accent]"># Custom Agent</span></p>
          <p>Connect to <span className="text-[--text-primary]">{instanceUrl}/mcp/sse</span> with SSE transport</p>
          <p>Pass <span className="text-[--text-primary]">Authorization: Bearer {"<api-key>"}</span> header</p>
        </div>
      </div>

      {/* Tools list */}
      <div className="space-y-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
          Available Tools
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            "list_events",
            "create_event",
            "update_event",
            "delete_event",
            "find_common_time",
            "get_availability",
            "search_events",
            "get_upcoming_events",
          ].map((tool) => (
            <div
              key={tool}
              className="rounded-[--radius-base] border border-[--border-subtle] bg-[--surface-elevated] px-3 py-2 font-mono text-xs text-[--text-primary]"
            >
              {tool}
            </div>
          ))}
        </div>
      </div>

      {/* Self-documenting MCP endpoint link */}
      <div className="space-y-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
          API Reference
        </h2>
        <a
          href="/api/mcp/config"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[--primary-accent] hover:underline"
        >
          <Wifi size={12} />
          GET /api/mcp/config
        </a>
        <p className="text-xs text-[--text-secondary]">
          Returns the complete MCP configuration as JSON. Use this endpoint for programmatic setup.
        </p>
      </div>
    </div>
  );
}
