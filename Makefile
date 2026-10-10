.PHONY: install dev build test test-node test-py lint migrate seed train-small clean

install:
	npm install
	cd services/ml && pip install -r requirements.txt

dev:
	npm run dev

build:
	npm run build

test: test-node test-py

test-node:
	npm test

test-py:
	cd services/ml && pytest tests -v

lint:
	npm run lint
	cd services/ml && ruff check .

migrate:
	npm run migrate --workspace=@forestwatch/api

seed:
	npm run seed --workspace=@forestwatch/api

train-small:
	python services/ml/forestwatch_ml/training/train.py --small

clean:
	rm -rf dist node_modules packages/*/dist apps/*/dist
