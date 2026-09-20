# PackForge

PackForge is a desktop app for managing your Minecraft mods, modpacks and instances. It is a fork of the [Modrinth App](https://github.com/modrinth/code/tree/main/apps/app), built with [Tauri](https://tauri.app/) and [Vue](https://vuejs.org/).

Download the latest release from the [releases page](../../releases).

## Development

### Pre-requisites

Before you begin, ensure you have the following installed on your machine:

- [Node.js](https://nodejs.org/en/)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri](https://v2.tauri.app/start/prerequisites/)

### Setup

Follow these steps to set up your development environment:

```bash
pnpm install
pnpm app:dev
```

You should now have a development build of the app running with hot-reloading enabled. Any changes you make to the code will automatically refresh the app.

## Attribution

PackForge is based on the Modrinth App by Rinth, Inc., and is distributed under the GNU General Public License, Version 3. See [COPYING.md](./COPYING.md) for details.
