#!/usr/bin/env bash

# openssl genrsa -des3 -passout pass:x -out dev.pass.key 2048  
# openssl rsa -passin pass:x -in dev.pass.key -out dev.key
# openssl req -new -key dev.key -out dev.csr
# openssl x509 -req -sha256 -days 365 -in dev.csr -signkey dev.key -out dev.crt
# openssl pkcs12 -export -out dev.pfx -inkey dev.key -in dev.crt

######################
# Become a Certificate Authority
######################

# Generate private key
# openssl genrsa -des3 -passout pass:x -out dev.key 2048  
# # Generate root certificate
# openssl req -x509 -new -nodes -key dev.key -sha256 -days 825 -out dev.pem

# ######################
# # Create CA-signed certs
# ######################

# NAME=azurestaticweb.app

# openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout dev.key -out dev.crt -config cert.conf -sha256
# cat dev.crt dev.key > dev.pem

openssl req -x509 -out localhost.crt -keyout localhost.key \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=localhost' -extensions EXT -config <( \
   printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")
