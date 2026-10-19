CREATE TABLE "video_formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"default_seconds" integer DEFAULT 45 NOT NULL,
	"parts" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_scripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"format_id" uuid,
	"format_name" text DEFAULT '' NOT NULL,
	"batch_id" uuid,
	"title" text DEFAULT 'Sem título' NOT NULL,
	"platform" text DEFAULT 'reels' NOT NULL,
	"seconds" integer DEFAULT 45 NOT NULL,
	"angle" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"data" jsonb NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_formats" ADD CONSTRAINT "video_formats_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_formats" ADD CONSTRAINT "video_formats_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_scripts" ADD CONSTRAINT "video_scripts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_scripts" ADD CONSTRAINT "video_scripts_format_id_video_formats_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."video_formats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_scripts" ADD CONSTRAINT "video_scripts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_formats_brand_idx" ON "video_formats" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "video_scripts_brand_idx" ON "video_scripts" USING btree ("brand_id","updated_at");--> statement-breakpoint
-- formatos globais
INSERT INTO "video_formats" ("name", "description", "default_seconds", "parts") VALUES ($n$Gancho, dica e CTA$n$, $d$O clássico enxuto: prende nos primeiros segundos, entrega uma dica útil e fecha com uma ação.$d$, 30, $j$[{"id": "p1", "name": "Gancho", "instruction": "Pare o scroll em até 3 segundos. Comece com uma pergunta direta, uma contradição ou uma promessa específica de resultado. Nada de \"oi gente\" nem apresentação. A primeira frase tem que fazer sentido sozinha.", "percent": 15}, {"id": "p2", "name": "Dica", "instruction": "Entregue UMA ideia principal, explicada com um exemplo concreto do dia a dia. Frases curtas, linguagem falada. Mostre o \"como\", não só o \"o quê\".", "percent": 65}, {"id": "p3", "name": "CTA", "instruction": "Peça uma única ação (salvar, comentar uma palavra, seguir) e dê um motivo claro para fazê-la. Termine de forma limpa, sem enrolar.", "percent": 20}]$j$::jsonb);--> statement-breakpoint
INSERT INTO "video_formats" ("name", "description", "default_seconds", "parts") VALUES ($n$Storytelling$n$, $d$Conte uma história em arco: situação, conflito, virada e lição. Ótimo para criar conexão.$d$, 60, $j$[{"id": "p1", "name": "Gancho", "instruction": "Abra no meio da ação ou com a frase mais intrigante da história (ex.: o resultado ou o erro). Em até 3 segundos o espectador precisa querer saber o que aconteceu.", "percent": 10}, {"id": "p2", "name": "Contexto", "instruction": "Apresente quem, onde e a situação inicial em poucas frases. Só o que é necessário para entender o conflito. Use detalhes sensoriais curtos.", "percent": 20}, {"id": "p3", "name": "Conflito", "instruction": "O problema, o erro ou o obstáculo. Aumente a tensão: o que estava em jogo? Fale de emoção e consequência, não só de fatos.", "percent": 25}, {"id": "p4", "name": "Virada", "instruction": "O momento em que algo muda: a decisão, a descoberta, a solução. Seja específico sobre o que foi feito diferente.", "percent": 25}, {"id": "p5", "name": "Lição", "instruction": "Traduza a história em um aprendizado aplicável pelo espectador. Uma frase de impacto que ele queira repetir.", "percent": 12}, {"id": "p6", "name": "CTA", "instruction": "Convide a uma ação ligada à história (ex.: \"já passou por isso? conta nos comentários\"). Curto.", "percent": 8}]$j$::jsonb);--> statement-breakpoint
INSERT INTO "video_formats" ("name", "description", "default_seconds", "parts") VALUES ($n$Lista (Top 3 a 5)$n$, $d$Uma lista numerada e rápida. Fácil de acompanhar e de salvar.$d$, 45, $j$[{"id": "p1", "name": "Gancho", "instruction": "Anuncie a lista com número e benefício (ex.: \"3 erros que...\", \"5 hábitos para...\"). Gere curiosidade sobre o último item.", "percent": 15}, {"id": "p2", "name": "Itens", "instruction": "Cada item tem: o número, o nome em poucas palavras e uma explicação de uma ou duas frases com exemplo. Mantenha o mesmo ritmo e tamanho em todos. Deixe o mais forte para o final.", "percent": 70}, {"id": "p3", "name": "CTA", "instruction": "Peça para salvar para consultar depois ou perguntar qual item o espectador mais usa. Uma ação só.", "percent": 15}]$j$::jsonb);--> statement-breakpoint
INSERT INTO "video_formats" ("name", "description", "default_seconds", "parts") VALUES ($n$Mito vs. verdade$n$, $d$Desmonta uma crença comum e explica o que é verdade. Gera comentário e compartilhamento.$d$, 30, $j$[{"id": "p1", "name": "Mito", "instruction": "Diga a crença comum de forma provocativa, como se fosse verdade, e mostre que quase todo mundo acredita. Termine com tensão (ex.: \"só que não é bem assim\").", "percent": 20}, {"id": "p2", "name": "Por que acreditam", "instruction": "Explique em uma ou duas frases por que o mito parece fazer sentido. Isso evita que o espectador se sinta atacado.", "percent": 20}, {"id": "p3", "name": "A verdade", "instruction": "Entregue a explicação correta de forma simples, com um exemplo ou comparação. Se houver dado, use só os que estão no conteúdo-fonte.", "percent": 45}, {"id": "p4", "name": "CTA", "instruction": "Convide a compartilhar com quem ainda acredita no mito ou a comentar outro mito que querem ver desmontado.", "percent": 15}]$j$::jsonb);--> statement-breakpoint
INSERT INTO "video_formats" ("name", "description", "default_seconds", "parts") VALUES ($n$Passo a passo$n$, $d$Tutorial rápido: mostra o resultado, ensina em etapas curtas e evita o erro mais comum.$d$, 60, $j$[{"id": "p1", "name": "Resultado", "instruction": "Mostre ou descreva o resultado final primeiro (o \"depois\"), com um número ou detalhe concreto. É a razão para o espectador ficar.", "percent": 12}, {"id": "p2", "name": "Antes de começar", "instruction": "O que precisa ter ou saber. Seja breve: no máximo uma frase por item.", "percent": 13}, {"id": "p3", "name": "Passos", "instruction": "Etapas numeradas e na ordem. Um verbo de ação por passo, uma instrução clara por passo. Diga o que aparece na tela em cada etapa.", "percent": 55}, {"id": "p4", "name": "Erro comum", "instruction": "O erro que mais atrapalha e como evitá-lo. Mostra experiência e gera confiança.", "percent": 10}, {"id": "p5", "name": "CTA", "instruction": "Peça para salvar o vídeo para consultar durante a prática e convide a mostrar o resultado nos comentários.", "percent": 10}]$j$::jsonb);--> statement-breakpoint
INSERT INTO "video_formats" ("name", "description", "default_seconds", "parts") VALUES ($n$Notícia explicada$n$, $d$Pega um fato ou notícia e explica o que importa para a vida da pessoa.$d$, 45, $j$[{"id": "p1", "name": "Manchete", "instruction": "Abra com o fato mais importante em uma frase clara e específica, sem sensacionalismo. Diga logo por que o espectador deveria se importar.", "percent": 15}, {"id": "p2", "name": "O que aconteceu", "instruction": "Explique os fatos essenciais na ordem lógica: quem, o quê, quando, números. Use apenas dados presentes no conteúdo-fonte.", "percent": 30}, {"id": "p3", "name": "Por que importa", "instruction": "Traduza para o impacto prático na vida do espectador: dinheiro, direitos, rotina. Dê um exemplo concreto.", "percent": 30}, {"id": "p4", "name": "E agora?", "instruction": "O que pode acontecer a seguir ou o que a pessoa pode fazer. Sinalize o que ainda é incerto.", "percent": 15}, {"id": "p5", "name": "CTA", "instruction": "Convide a seguir para acompanhar o assunto ou a comentar uma dúvida que será explicada.", "percent": 10}]$j$::jsonb);--> statement-breakpoint
