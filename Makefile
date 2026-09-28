.PHONY: install test smoke

install:
	cd server && npm install
	cd client && npm install

test:
	cd server && npm test

smoke:
	cd server && npm run smoke
