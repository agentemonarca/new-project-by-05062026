# Genesis (G-Pulse) — despliegue producción en AWS

Guía para un despliegue **seguro y escalable** del `core-api` (wallet Genesis, P2P, rewards) y su observabilidad.

## 1. Entorno de producción

### Variables críticas

- Usar `deploy/aws/env.production.example` como checklist. Valores reales en **Secrets Manager** o **SSM Parameter Store** (tipo SecureString).
- `NODE_ENV=production`, `SESSION_COOKIE_SECURE=1`, secretos largos y rotados.
- `GENESIS_ADMIN_API_KEY`: solo operaciones humanas/automatización interna; no exponer al frontend.
- `GENESIS_PROMETHEUS_SCRAPE_TOKEN`: token dedicado para scrape (distinto del admin key); misma cadena en Prometheus `credentials_file`.

### Red

- API detrás de **Application Load Balancer** en subredes privadas con egress a NAT; DocumentDB/Mongo y Redis solo accesibles desde la VPC.
- Security Groups: solo ALB → tareas/containers en `5050`; Mongo `27017` solo desde SG del servicio API.

## 2. MongoDB con replica set (transacciones ACID)

Genesis usa transacciones multi-documento para settlement P2P, transfers y claims cuando `GENESIS_DISABLE_MONGO_TRANSACTIONS` **no** está activo.

### Opción A — Amazon DocumentDB

- Crear clúster **con varias instancias** (replica set gestionado).
- TLS obligatorio: URI con `tls=true` y CA `rds-combined-ca-bundle.pem` si el driver lo requiere (Mongoose suele usar `tls=true` en connection string).
- Comprobar compatibilidad de operadores de agregación usados en `claimRewardsPendingUsd` (pipeline).

### Opción B — MongoDB Atlas en AWS

- M10+ con replica set en la misma región; peering VPC o Private Endpoint.
- Connection string con `replicaSet=...`.

### Opción C — Autogestionado en EC2

- Mínimo 3 nodos para elecciones; configurar `replicaSet=rs0` y usuario con privilegios acotados.
- Backups automáticos y monitoreo de lag de réplicas.

### URI ejemplo

```text
mongodb://USER:PASS@docdb-1.cluster-xxx.region.docdb.amazonaws.com:27017/genesis?tls=true&replicaSet=rs0&retryWrites=false
```

(Ajustar nombre de DB y parámetros según DocumentDB vs Mongo nativo.)

## 3. Despliegue del backend

### Docker (recomendado: ECS Fargate o EKS)

```bash
cd backend/core-api
docker build -t g-pulse-core-api:latest .
aws ecr get-login-password --region REGION | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.REGION.amazonaws.com
docker tag g-pulse-core-api:latest ACCOUNT.dkr.ecr.REGION.amazonaws.com/g-pulse-core-api:latest
docker push ACCOUNT.dkr.ecr.REGION.amazonaws.com/g-pulse-core-api:latest
```

- Ver `ecs-task-definition.example.json`: logging **awslogs** → grupo `/ecs/g-pulse-core-api` (integración CloudWatch automática).
- Escalado: ECS Service con target tracking sobre CPU o sobre **ALB request count**; mínimo 2 tareas en distintas AZ.

### EC2 (alternativa)

- Misma imagen Docker o `npm ci && npm run build:db && npm run build:compensation && node src/server.js` con **systemd**.
- Delante, ALB + certificado ACM; no exponer Node directamente a Internet.

## 4. Dominio y SSL

1. **ACM**: solicitar certificado público para `api.tudominio.com` (validación DNS en Route 53).
2. **ALB**: listener `443` con certificado ACM; `HTTP:80` → redirect 301 a HTTPS.
3. **Route 53**: alias A/AAAA al ALB.
4. Aplicación: `SOCKET_CORS_ORIGIN`, URLs del frontend y webhooks apuntando a `https://api...`.

## 5. Logs → Amazon CloudWatch

### ECS/Fargate

- `logConfiguration` con `awslogs` (como en `ecs-task-definition.example.json`).
- El logger del API ya emite **JSON por línea** (`logger.info` / `metric` / errores); CloudWatch Logs Insights permite consultas por `msg`, `level`, `domain`, `event`.

Consultas útiles (Insights):

```sql
fields @timestamp, msg, domain, event, message
| filter msg = "genesis_structured" or msg = "AUDIT_DRIFT_CRITICAL"
| sort @timestamp desc
| limit 100
```

### EC2

- Opción 1: aplicación escribe a stdout → **CloudWatch agent** con `logs` (ajustar `file_path` o usar `journald`).
- Opción 2: archivo rotado (ver ejemplo `cloudwatch/amazon-cloudwatch-agent.json`); crear log group `/aws/ec2/g-pulse-core-api` y rol IAM `CloudWatchAgentServerPolicy`.

### Alertas

- **Metric Filter** + **SNS** sobre patrones `AUDIT_DRIFT_CRITICAL` / `GENESIS_CRITICAL_FAILURE`.
- O **CloudWatch Logs Subscription Filter** → Lambda → Slack/PagerDuty.

## 6. Prometheus + Grafana

### Exposición de métricas

- Endpoint: `GET https://api.tudominio.com/api/metrics/genesis`
- Autenticación: header `Authorization: Bearer <GENESIS_PROMETHEUS_SCRAPE_TOKEN>` **o** `X-Genesis-Metrics-Token`.
- Si la variable no está definida, el endpoint responde `404` (no filtración de capacidad).

### Prometheus

- Configuración de ejemplo: `prometheus/prometheus.yml` (target y `bearer_token_file`).
- En VPC: Prometheus en EC2/ECS con acceso saliente HTTPS al ALB interno o a NLB privado.

### Grafana

- `docker-compose.observability.yml` levanta Prometheus + Grafana con provisioning básico.
- Añadir paneles con queries PromQL, por ejemplo:
  - `genesis_p2p_trades_settled_total`
  - `genesis_rewards_wallet_claims_total`
  - `genesis_ledger_drift_alerts_total`
  - `genesis_critical_alerts_total`

### Amazon Managed Prometheus + Grafana

- Configurar **scraping** desde la VPC hacia el mismo endpoint protegido por Bearer almacenado en **Secrets Manager** y montado en el agente/AMP collector.

## 7. Checklist pre-producción

- [ ] `MONGO_URI` apunta a replica set; probado settlement + claim bajo carga mínima.
- [ ] `GENESIS_PROMETHEUS_SCRAPE_TOKEN` y rotación documentada.
- [ ] Auditoría programada: `POST /api/admin/audit/run` (EventBridge → Lambda con admin key en secret).
- [ ] Dashboard operativo: `GET /api/admin/genesis/observability/dashboard` (solo admin key).
- [ ] Backups Mongo/DocumentDB y prueba de restauración.
- [ ] WAF en ALB (rate limit, reglas básicas) si el API es público.

## Archivos en esta carpeta

| Ruta | Uso |
|------|-----|
| `env.production.example` | Variables de referencia |
| `Dockerfile` | En `backend/core-api/` (raíz del build) |
| `ecs-task-definition.example.json` | Plantilla Fargate |
| `prometheus/prometheus.yml` | Scrape del API |
| `grafana/provisioning/` | Datasource Prometheus |
| `docker-compose.observability.yml` | Prometheus + Grafana |
| `cloudwatch/amazon-cloudwatch-agent.json` | Ejemplo agente EC2 |
