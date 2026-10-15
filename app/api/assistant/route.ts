import OpenAI from "openai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY ainda não foi configurada." }, { status: 400 });
    if (!model) return NextResponse.json({ error: "OPENAI_MODEL ainda não foi configurado." }, { status: 400 });
    const { question, context } = await request.json();
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model,
      instructions: "Você é o Assistente Fazenda, orientador de estudos para concursos. Use somente os dados fornecidos. Priorize o concurso ativo, o plano do dia, cobertura, domínio, erros recorrentes e revisões. Explique conflitos entre percepção de dificuldade e desempenho objetivo. Não invente dados. Responda em português brasileiro, de forma prática.",
      input: `Pergunta: ${question}\n\nDados do sistema:\n${JSON.stringify(context, null, 2)}`,
    });
    return NextResponse.json({ answer: response.output_text });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao consultar a IA." }, { status: 500 });
  }
}
