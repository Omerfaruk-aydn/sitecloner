#!/usr/bin/env node
'use strict';
/**
 * _run.js — Global script wrapper
 *
 * Tüm scriptleri herhangi bir projeden çalıştırmaya yarar.
 * process.chdir() ile çalışma dizinini CLONE_PROJECT_DIR'e taşır,
 * böylece script'in kendi path.resolve('docs/...') çağrıları
 * doğru projeye yazar.
 *
 * Kullanım (clone-website.md içinden):
 *   CLONE_PROJECT_DIR="/proje/yolu" node "C:\site clone ai\scripts\_run.js" recon.js <arg>
 */

const path = require('path');
const fs   = require('fs');

const scriptName = process.argv[2];
if (!scriptName) {
  console.error('❌  Kullanım: node _run.js <script.js> [...args]');
  process.exit(1);
}

// Proje dizinine geç — böylece tüm path.resolve() çağrıları oraya yazar
const projectDir = process.env.CLONE_PROJECT_DIR;
if (projectDir) {
  if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
  process.chdir(projectDir);
}

// argv'yi düzenle — _run.js ve scriptName'i çıkar, gerçek argümanları bırak
process.argv = [process.argv[0], scriptName, ...process.argv.slice(3)];

// Script'i çalıştır
require(path.join(__dirname, scriptName));
