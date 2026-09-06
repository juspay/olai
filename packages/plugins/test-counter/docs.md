# Non-notebook fixture

This maintained fixture is disabled in normal profiles. Its server owns an
in-memory counter and two Surface procedures, requiring only the host's
surface-registration capability. Its browser half supplies a tiny shell through
`ui-renderer.root` and consumes its own wire. Neither entry imports a vault,
directory, outline, Markdown, navigation or application-layout implementation.

Server activation owns the value; reactivation starts at zero. Browser root
withdrawal aborts pending requests and prevents departed UI from publishing.
The same server procedures are exposed to browser and headless agent faces.
