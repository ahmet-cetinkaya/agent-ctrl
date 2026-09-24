import type { IMcpConfigRenderer } from "./IMcpConfigRenderer";
import { ForgeCodeMcpConfigRenderer } from "./ForgeCodeMcpConfigRenderer";

/**
 * Pi platform MCP config renderer.
 *
 * Pi's core has no native MCP configuration surface, but the most widely adopted community
 * extension (`pi-mcp-adapter`, npm) reads `.mcp.json` in the same `{ mcpServers: {...} }`
 * shape used by Claude Desktop, ForgeCode, and several other agent-ctrl targets — so this
 * renderer simply extends the ForgeCode one instead of duplicating it. Only invoked when
 * that extension is detected as installed — see `PiAdapter.isPackageInstalled()`.
 */
export class PiMcpConfigRenderer extends ForgeCodeMcpConfigRenderer implements IMcpConfigRenderer {}
