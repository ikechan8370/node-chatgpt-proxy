# node-chatgpt-proxy
 
![Docker Pulls](https://img.shields.io/docker/pulls/geyinchi/node-chatgpt-proxy?logo=docker&style=plastic)
![Docker Image Size (latest by date)](https://img.shields.io/docker/image-size/geyinchi/node-chatgpt-proxy?logo=docker)
![GitHub top language](https://img.shields.io/github/languages/top/ikechan8370/node-chatgpt-proxy?logo=github)

A simple reverse proxy for chat.openai.com which can bypass cloudflare protection.

This project has been used by [chatgpt-plugin](https://github.com/ikechan8370/chatgpt-plugin) for months, and huge improvements in performance and stability have been made to it.

Give me a star if this project helps or you are using any service supported by it.

## How to use

### with source code

prepare your config.json file, for example: 

```json
{
  "chromePath": "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "proxy": "http://127.0.0.1:7890"
}

```

and then use `npm run start` to start the server.

### with docker

just run `docker run -d -p [PORT]:3000 --name node-chatgpt-proxy --shm-size=1gb geyinchi/node-chatgpt-proxy`

Check log: `docker exec -it node-chatgpt-proxy tail -100f /var/log/node-chatgpt-proxy.log`

Check new version and update: `docker pull geyinchi/node-chatgpt-proxy && docker stop node-chatgpt-proxy && docker rm node-chatgpt-proxy && docker run -d -p [PORT
]:3000 --name node-chatgpt-proxy --shm-size=1gb geyinchi/node-chatgpt-proxy`

## about the API

Currently, only http://[ip]:[port]/backend-api/conversation is supported, other APIs need to be tested by yourself.
You can use the default 3.5 model without a token. After logging in, you can use the gpt-4o model.

# 中文

一个简单的chat.openai.com的反代，基于浏览器绕过Cloudflare防护。

本项目目前用于[chatgpt-plugin](https://github.com/ikechan8370/chatgpt-plugin)插件，经中等规模用户长期使用，稳定性不错。

如果这个项目对你有帮助或者你就在使用基于这个项目的其他开源项目，请给我一个免费的Star，谢谢！

## 如何使用

### 源码部署

准备一个config.json文件，例如：

```json
{
  "chromePath": "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "proxy": "http://127.0.0.8:7890"
}
```

然后使用`npm run start`启动服务。

### 使用docker
直接运行 `docker run -d -p [PORT]:3000 --name node-chatgpt-proxy --shm-size=1gb geyinchi/node-chatgpt-proxy`

查看日志: `docker exec -it node-chatgpt-proxy tail -100f /var/log/node-chatgpt-proxy.log`

检查新版本并更新: `docker pull geyinchi/node-chatgpt-proxy && docker stop node-chatgpt-proxy && docker rm node-chatgpt-proxy && docker run -d -p [端口号]:3000 --name node-chatgpt-proxy --shm-size=1gb geyinchi/node-chatgpt-proxy`

可以参考这篇博客：https://ikechan8370.com/archives/da-jian-chatgpt-guan-fang-fan-xiang-dai-li


## 关于API

目前支持http://[ip]:[port]/backend-api/conversation，其他API请自行测试。
可以不传token，将使用未登录模式，默认的3.5模型。登陆后可使用gpt-4o.
