FROM node:18-bullseye-slim

RUN apt-get update && \
    apt-get install -y xvfb supervisor wget

RUN wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    apt-get install -yf ./google-chrome-stable_current_amd64.deb && \
    rm google-chrome-stable_current_amd64.deb

ADD ./ /node-chatgpt-proxy

WORKDIR /node-chatgpt-proxy

RUN npm install -g pnpm && pnpm i

RUN apt-get clean ; \
    		rm -rf /var/cache/* /var/log/apt/* /var/lib/apt/lists/* /tmp/*

RUN touch config.json
ENV JSON_STR='{"chromePath": "/usr/bin/google-chrome"}'
RUN echo $JSON_STR > config.json

ADD conf/ /

EXPOSE 3000

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

