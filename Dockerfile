FROM node:22-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-venv \
    build-essential \
    libmagic-dev \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment and update PATH so it is used automatically
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# RUN pip install unstructured unstructured[all] pypdf --no-cache-dir

RUN pip install langchain-community langchain-text-splitters pypdf --no-cache-dir

COPY package*.json ./

RUN npm install

COPY ./src /app/src

ENTRYPOINT  ["npm", "run"]