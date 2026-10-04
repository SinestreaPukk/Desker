import "server-only";
import { addTeamMessage, type TeamAgent } from "@/lib/agents/team";
import { listMemories, recallMemories, forgetMemory } from "@/lib/memory/store";
import { listCommitments } from "@/lib/commitments/store";
import { updateTriggerRule, whyDidYouMessage, whyDidntYouMessage } from "@/lib/triggers/engine";

interface CommandCtx {
  projectId: string;
  organizationId: string;
  threadId: string;
  userId: string;
}

/**
 * Handles explicit assistant core commands in chat and LINE:
 *  - Memory: "what do you know about me", "what do you know about my mom", "forget that"
 *  - Commitments: "what am I waiting on?", "open loops"
 *  - Trigger controls: "move my brief to 7:30", "only urgent things at night", "stop telling me about X"
 *  - Trigger audits: "why did you message me", "why didn't you message me"
 *
 * Returns true if a command was recognized and answered, false otherwise.
 */
export async function handleAssistantCommand(
  text: string,
  ctx: CommandCtx,
  speaker: TeamAgent,
): Promise<boolean> {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const say = (content: string) =>
    addTeamMessage({ projectId: ctx.projectId, threadId: ctx.threadId, agentId: speaker.id, content });

  // 1. "Why did you message me"
  if (/^why did you (?:message|text|alert|notify) me\??$/i.test(lower) || /^why did you message\??$/i.test(lower)) {
    const reason = await whyDidYouMessage(ctx.projectId);
    await say(reason);
    return true;
  }

  // 2. "Why didn't you message me"
  if (/^why didn'?t you (?:message|text|alert|notify) me\??$/i.test(lower) || /^why didn'?t you message\??$/i.test(lower)) {
    const reason = await whyDidntYouMessage(ctx.projectId);
    await say(reason);
    return true;
  }

  // 3. "What do you know about me" / "what do you remember about me"
  if (
    /^(?:what do you know about me|what do you remember about me|show my memories|what memories do you have)\??$/i.test(lower)
  ) {
    const memories = await listMemories(ctx.projectId);
    const confirmed = memories.filter((m) => m.status === "confirmed");
    if (!confirmed.length) {
      await say("I don't have any saved facts about you yet. Tell me your preferences or details anytime!");
      return true;
    }
    const lines = confirmed.slice(0, 15).map((m) => `- ${m.fact}${m.person?.name ? ` (${m.person.name})` : ""}`);
    await say(`Here's what I know about you:\n${lines.join("\n")}`);
    return true;
  }

  // 4. "What do you know about [person]"
  const aboutPersonMatch = lower.match(/^what do you (?:know|remember) about (?:my )?([a-zA-Z\u0E00-\u0E7F\s]+)\??$/i);
  if (aboutPersonMatch) {
    const target = aboutPersonMatch[1]!.trim();
    if (target !== "me") {
      const recalled = await recallMemories({
        projectId: ctx.projectId,
        query: target,
        personName: target,
        limit: 10,
      });
      if (!recalled.length) {
        await say(`I don't have any saved facts about ${target} yet.`);
        return true;
      }
      const lines = recalled.map((m) => `- ${m.fact}`);
      await say(`Here's what I know about ${target}:\n${lines.join("\n")}`);
      return true;
    }
  }

  // 5. "Forget that" / "forget [fact]"
  if (/^forget (?:that|this|last|everything)\b/i.test(lower) || lower === "forget that") {
    const res = await forgetMemory({ projectId: ctx.projectId, query: "that" });
    await say(res.message);
    return true;
  }
  const forgetMatch = lower.match(/^forget (?:about )?(.+)$/i);
  if (forgetMatch && !lower.startsWith("forget to")) {
    const targetFact = forgetMatch[1]!.trim();
    const res = await forgetMemory({ projectId: ctx.projectId, query: targetFact });
    await say(res.message);
    return true;
  }

  // 6. "What am I waiting on?" / "open loops"
  if (
    /^(?:what am i waiting on|what are my open loops|open loops|what am i promised|list my commitments)\??$/i.test(lower)
  ) {
    const commitments = await listCommitments(ctx.projectId, { status: "active" });
    if (!commitments.length) {
      await say("You don't have any open loops or items you're waiting on right now.");
      return true;
    }
    const lines = commitments.map((c) => {
      const waiting = c.type === "waiting_on" || c.ownerRole === "other";
      const who = c.ownerName ? (waiting ? `waiting on ${c.ownerName}` : c.ownerName) : (waiting ? "waiting on someone" : "you");
      const due = c.dueAt ? `, due ${c.dueAt.slice(0, 10)}` : "";
      return `- [${c.type}] ${c.outcome} (${who}${due})`;
    });
    await say(`Here are your open commitments and loops:\n${lines.join("\n")}\n\nTo close an item, tell me to mark it done or drop it.`);
    return true;
  }

  // 7. "Move my brief to 7:30"
  const briefTimeMatch = lower.match(/(?:move|change|set)(?: my)? (?:morning )?brief to (\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)/i);
  if (briefTimeMatch) {
    let rawTime = briefTimeMatch[1]!.trim();
    // Normalize to HH:mm
    if (/^\d{1,2}$/.test(rawTime)) {
      rawTime = `${rawTime.padStart(2, "0")}:00`;
    } else if (/^\d{1,2}:\d{2}$/.test(rawTime)) {
      const [h, m] = rawTime.split(":");
      rawTime = `${h!.padStart(2, "0")}:${m}`;
    }
    await updateTriggerRule(ctx.projectId, {
      ruleName: "morning_brief",
      time: rawTime,
    });
    await say(`Updated: morning brief set to ${rawTime}.`);
    return true;
  }

  // 8. "Only urgent things at night"
  if (/only urgent(?: things)? at night/i.test(lower) || /urgent only at night/i.test(lower)) {
    await updateTriggerRule(ctx.projectId, {
      ruleName: "morning_brief",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    });
    await say("Noted: during quiet hours (22:00–07:00), I'll only notify you for urgent items.");
    return true;
  }

  // 9. "Stop telling me about X"
  const stopMatch = lower.match(/^stop telling me about (.+)$/i) || lower.match(/^don'?t (?:notify|message|alert) me about (.+)$/i);
  if (stopMatch) {
    const topic = stopMatch[1]!.trim();
    let ruleName = "morning_brief";
    if (/bill|invoice/i.test(topic)) ruleName = "due_soon_alert";
    else if (/conflict|tight/i.test(topic)) ruleName = "conflict_alert";
    else if (/waiting|late/i.test(topic)) ruleName = "waiting_on_late";
    else if (/digest|week/i.test(topic)) ruleName = "weekly_digest";

    await updateTriggerRule(ctx.projectId, {
      ruleName,
      enabled: false,
      addSuppressedTopic: topic,
    });
    await say(`Turned off alerts about ${topic}. You can re-enable them in settings anytime.`);
    return true;
  }

  return false;
}
