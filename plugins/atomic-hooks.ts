/**
 * Atomic VCS Hooks Plugin for Kilo Code
 *
 * Hooks into session lifecycle, chat messages, and tool execution
 * to provide full turn-level provenance recording with tool arguments
 * and results.
 *
 * 1 session = 1 view. Each turn records with provenance.
 *
 * @see https://kilo.ai/docs/automate/extending/plugins
 */
import type { Plugin } from "@kilocode/plugin";

const AtomicHooks: Plugin = async ({ $, directory }) => {
  try {
    const v = Bun.spawnSync(["atomic", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (v.exitCode !== 0) return {};
    const d = Bun.spawnSync(["test", "-d", `${directory}/.atomic`], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (d.exitCode !== 0) return {};
  } catch {
    return {};
  }

  let sid: string | null = null;
  let model: string | null = null;
  let provider: string | null = null;
  let turns = 0;
  const toolStartTimes = new Map<string, number>();
  // Stash args from before-tool so after-tool can include them
  const toolArgs = new Map<string, Record<string, unknown>>();

  async function hook(verb: string, payload: Record<string, unknown>) {
    try {
      const json = JSON.stringify(payload);
      await $`echo ${json} | atomic agent hooks kilo ${verb} 2>/dev/null`.nothrow();
    } catch {}
  }

  return {
    event: async ({ event }) => {
      if (event.type === "session.created") {
        sid = (event as any).properties?.sessionID;
        await hook("session-start", {
          session_id: sid,
          source: "startup",
          cwd: directory,
          timestamp: new Date().toISOString(),
        });
      } else if (event.type === "session.idle") {
        if (!sid) return;
        turns++;
        await hook("stop", {
          session_id: sid,
          turn_number: turns,
          model,
          provider,
          cwd: directory,
          timestamp: new Date().toISOString(),
        });
      } else if (event.type === "session.deleted") {
        if (!sid) return;
        await hook("session-end", {
          session_id: sid,
          reason: "deleted",
          cwd: directory,
          timestamp: new Date().toISOString(),
        });
      }
    },

    "chat.message": async (input, output) => {
      if ((input as any).model) {
        model = (input as any).model.modelID;
        provider = (input as any).model.providerID;
      }
      const prompt = (output as any).parts
        ?.filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("\n")
        .trim();
      await hook("user-prompt", {
        session_id: sid || (input as any).sessionID,
        prompt: prompt || undefined,
        model,
        provider,
        cwd: directory,
        timestamp: new Date().toISOString(),
      });
    },

    "tool.execute.before": async (input, output) => {
      if (!sid) return;
      const callID = (input as any).callID;
      const args = (output as any).args || {};

      toolStartTimes.set(callID, Date.now());
      toolArgs.set(callID, args);

      await hook("before-tool", {
        session_id: sid,
        tool_name: (input as any).tool,
        tool_call_id: callID,
        tool_input: args,
        cwd: directory,
        timestamp: new Date().toISOString(),
      });
    },

    "tool.execute.after": async (input, output) => {
      if (!sid) return;
      const callID = (input as any).callID;
      const startTime = toolStartTimes.get(callID);
      const duration = startTime ? Date.now() - startTime : undefined;
      const args = toolArgs.get(callID) || {};
      toolStartTimes.delete(callID);
      toolArgs.delete(callID);

      // Capture result — truncate long output
      const rawOutput = (output as any).output;
      const title = (output as any).title;
      const metadata = (output as any).metadata;
      let toolOutput: string | undefined;
      if (typeof rawOutput === "string") {
        toolOutput =
          rawOutput.length > 2048 ? rawOutput.slice(0, 2048) + "…" : rawOutput;
      }

      await hook("after-tool", {
        session_id: sid,
        tool_name: (input as any).tool,
        tool_call_id: callID,
        tool_input: args,
        tool_output: toolOutput,
        title,
        file_path: args.filePath || args.path,
        status: "completed",
        duration,
        cwd: directory,
        timestamp: new Date().toISOString(),
      });
    },

    "shell.env": async (_input, output) => {
      (output as any).env.ATOMIC_AGENT = "kilo";
      (output as any).env.ATOMIC_AGENT_VERSION = "1.0.0";
    },
  };
};

export default { id: "atomic-hooks", server: AtomicHooks };
