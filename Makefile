.PHONY: dev
dev: setup
	mkdir -p .temp
	cd .temp && ../src/m3u8/main.ts

.PHONY: setup
setup:
	bun install --frozen-lockfile
