{{- define "lunch-map.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "lunch-map.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "lunch-map.labels" -}}
app.kubernetes.io/name: {{ include "lunch-map.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "lunch-map.apiName" -}}
{{ include "lunch-map.fullname" . }}-api
{{- end -}}

{{- define "lunch-map.webName" -}}
{{ include "lunch-map.fullname" . }}-web
{{- end -}}

{{- define "lunch-map.selectorLabels" -}}
app.kubernetes.io/name: {{ include "lunch-map.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
