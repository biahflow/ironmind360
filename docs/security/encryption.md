# Política de criptografia

Esta política faz parte da Fase 0 e vale para documentos de saúde, fotos,
credenciais de integrações e demais campos sensíveis.

## Arquivos originais e derivados

- Produção deve usar storage S3 compatível com criptografia server-side
  `aws:kms` e uma chave identificada por `S3_KMS_KEY_ID`.
- A chave fica no KMS do ambiente, nunca no MongoDB, na imagem Docker ou no
  repositório.
- Originais e derivados usam chaves de objeto privadas e IDs opacos distintos.
- A aplicação recusa inicialização em produção sem provider externo, algoritmo
  KMS e identificador de chave.
- MinIO local não simula uma chave de produção. O ambiente local usa dados
  descartáveis, bucket privado e volumes explicitamente locais.

## Campos sensíveis no MongoDB

- Credenciais como a chave da intervals.icu devem usar envelope encryption:
  uma DEK aleatória por registro, AES-256-GCM e AAD contendo coleção, campo,
  proprietário e versão do schema.
- A DEK é cifrada por uma KEK externa. O banco armazena apenas ciphertext,
  nonce, tag, DEK cifrada, key id e versão.
- Rotação cria uma nova versão de ciphertext; nunca registra plaintext em logs,
  auditoria ou mensagens de erro.
- O adapter de KMS deve permitir AWS KMS ou serviço compatível sem acoplar o
  domínio. A implementação de cada campo ocorre junto da funcionalidade que o
  introduzir; plaintext de produção é proibido pela validação de configuração.

## Recuperação e deleção

- Backups herdam criptografia e controle de acesso do ambiente.
- Exclusão permanente remove objetos, derivados e envelopes associados.
- Revogação ou destruição da chave é uma medida adicional, não substitui a
  exclusão física implementada pela aplicação.
