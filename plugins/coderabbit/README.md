# CodeRabbit bundled MCP pilot

This branch prepares **install plugin → connect CodeRabbit once → review my
changes**. The bundled CLI collects local code; the hosted MCP service manages
sign-in, jobs, and findings. No separate CLI installation or login is needed
once a complete compatible package is installed.

This is an unpublished pilot. The Git source tree alone does not contain the
native binaries or a hosted endpoint. See [package assembly](packaging/README.md)
for the required pinned CLI artifacts, endpoint, and release acceptance checks.
Installing this source directly is not equivalent to installing the assembled
package. Directory publication remains separate.
