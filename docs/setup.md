# Setup & Commands

## Install
```
npm install
cp .env.example .env.local   # fill APIFY_TOKEN, LLM_API_KEY
```

## Lint  (read by pre-commit hook)
```
# LINT_CMD: npx tsc --noEmit
```

## Test  (read by pre-commit hook)
```
# TEST_CMD: npm test
```

## Run locally
```
npm run dev
```
