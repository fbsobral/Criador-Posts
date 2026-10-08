ALTER TABLE "color_palettes" ADD COLUMN "editor" text DEFAULT 'carrossel' NOT NULL;
--> statement-breakpoint
INSERT INTO "templates" ("name", "description", "editor") VALUES ('Tweet Card', 'Logo no topo e card estilo post de rede social (foto, nome, texto, botão opcional e métricas) sobre fundo colorido.', 'tweet');
