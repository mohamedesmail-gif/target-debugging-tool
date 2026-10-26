# Serves the prebuilt static site (run `npm run web:build` first: it needs the private data pack, so the data never enters the image build context).
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist-web /usr/share/nginx/html
EXPOSE 80
