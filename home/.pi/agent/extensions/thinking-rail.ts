// Thinking rail, full text (violet rail via theme mdQuoteBorder). Public API only.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.registerMarkdownTransformer((md, ctx) => {
		if (ctx.messageType !== "assistant-thinking") return md;
		const body = md
			.split("\n")
			.map((l) => (l.trim() ? `> ${l}` : ">"))
			.join("\n");
		const head = ctx.isStreaming ? "> **● Thinking…**" : "> **Thought**";
		return `${head}\\\n${body}`;
	});
}
