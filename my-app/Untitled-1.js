location / {
    proxy_pass http://dashboard_frontend:80;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    try_files $uri $uri/ /index.html;
}
AQua1992@.c