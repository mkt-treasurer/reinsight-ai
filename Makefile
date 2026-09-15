R := \033[0;31m
G := \033[0;32m
C := \033[0;36m
Y := \033[1;33m
W := \033[1;37m
D := \033[0;90m
NC := \033[0m

.PHONY: dev stop logs build

dev:
	@if [ "$$TERM_PROGRAM" != "iTerm.app" ]; then \
		echo "Error: requires iTerm2. Current: $${TERM_PROGRAM:-unknown}"; \
		exit 1; \
	fi
	@clear
	@echo ""
	@echo "$(C)    ╔═══════════════════════════════════════════════╗$(NC)"
	@echo "$(C)    ║$(NC)                                               $(C)║$(NC)"
	@echo "$(C)    ║$(W)      ██████╗ ███████╗██╗███╗   ██╗███████╗    $(C)║$(NC)"
	@echo "$(C)    ║$(W)      ██╔══██╗██╔════╝██║████╗  ██║██╔════╝    $(C)║$(NC)"
	@echo "$(C)    ║$(W)      ██████╔╝█████╗  ██║██╔██╗ ██║███████╗    $(C)║$(NC)"
	@echo "$(C)    ║$(W)      ██╔══██╗██╔══╝  ██║██║╚██╗██║╚════██║    $(C)║$(NC)"
	@echo "$(C)    ║$(W)      ██║  ██║███████╗██║██║ ╚████║███████║    $(C)║$(NC)"
	@echo "$(C)    ║$(W)      ╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝    $(C)║$(NC)"
	@echo "$(C)    ║$(NC)                                               $(C)║$(NC)"
	@echo "$(C)    ║$(D)           ReinsAI Dev Stack (docker)           $(C)║$(NC)"
	@echo "$(C)    ║$(NC)                                               $(C)║$(NC)"
	@echo "$(C)    ╚═══════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "    $(D)───────────────────────────────────────────────$(NC)"
	@echo "    $(Y)▸$(NC) $(W)tunnel$(NC)     $(D)SSH tunnel :7700(pg) :7703(redis)$(NC)"
	@echo "    $(G)▸$(NC) $(W)compose$(NC)    $(D)backend :7601  worker  frontend :7602$(NC)"
	@echo "    $(D)───────────────────────────────────────────────$(NC)"
	@echo ""
	@-pkill -f "ssh.*7700.*7703" 2>/dev/null; true
	@-docker compose down --remove-orphans 2>/dev/null; true
	@sleep 0.5
	@echo "    $(D)[$(G)0/2$(D)]$(NC) Killed stale processes / containers"
	@sleep 0.3
	@echo "    $(D)[$(G)1/2$(D)]$(NC) Splitting panes..."
	@osascript \
		-e 'tell application "iTerm2"' \
		-e '  activate' \
		-e '  tell current window' \
		-e '    tell current session' \
		-e '      set session2 to (split horizontally with default profile)' \
		-e '    end tell' \
		-e '    delay 2' \
		-e '    tell first session of current tab' \
		-e '      write text "cd \"$(CURDIR)\" && ./scripts/ssh-tunnel.sh"' \
		-e '    end tell' \
		-e '    tell session2' \
		-e '      write text "cd \"$(CURDIR)\" && sleep 3 && docker compose up --build"' \
		-e '    end tell' \
		-e '  end tell' \
		-e 'end tell'
	@echo "    $(D)[$(G)2/2$(D)]$(NC) $(G)All services dispatched$(NC) $(G)✓$(NC)"
	@echo ""
	@echo "    $(D)DB remote via SSH tunnel (pg:7700, redis:7703)$(NC)"
	@echo "    $(D)Happy hacking$(NC) $(R)♥$(NC)"
	@echo ""

build:
	@docker compose build

logs:
	@docker compose logs -f --tail=100

stop:
	@echo "    Stopping services..."
	@-docker compose down --remove-orphans 2>/dev/null
	@-pkill -f "ssh.*7700.*7703" 2>/dev/null
	@echo "    $(G)Done$(NC) $(G)✓$(NC)"
