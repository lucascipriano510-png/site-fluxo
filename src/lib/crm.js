import { supabase } from './supabaseClient';

export async function fetchAtendimentos() {
  const { data, error } = await supabase
    .from('crm_atendimentos')
    .select('*, contato:crm_contatos(*)')
    .order('atualizado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchAtendimento(id) {
  const { data, error } = await supabase
    .from('crm_atendimentos')
    .select('*, contato:crm_contatos(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchMensagens(atendimentoId) {
  const { data, error } = await supabase
    .from('crm_mensagens')
    .select('*')
    .eq('atendimento_id', atendimentoId)
    .order('criado_em', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addMensagem({ atendimentoId, direcao, tipo = 'sistema', conteudo }) {
  const { data, error } = await supabase
    .from('crm_mensagens')
    .insert([{ atendimento_id: atendimentoId, direcao, tipo, conteudo }])
    .select()
    .single();
  if (error) throw error;
  await supabase
    .from('crm_atendimentos')
    .update({ ultima_mensagem: conteudo, atualizado_em: new Date().toISOString() })
    .eq('id', atendimentoId);
  return data;
}

export async function updateAtendimentoStatus(id, status) {
  const { error } = await supabase
    .from('crm_atendimentos')
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updateContatoObservacoes(contatoId, observacoes) {
  const { error } = await supabase
    .from('crm_contatos')
    .update({ observacoes, ultima_interacao: new Date().toISOString() })
    .eq('id', contatoId);
  if (error) throw error;
}

export async function criarAtendimentoFromPedido(order) {
  // Evita duplicidade para o mesmo pedido
  const { data: existing } = await supabase
    .from('crm_atendimentos')
    .select('id')
    .eq('pedido_id', order.id)
    .maybeSingle();
  if (existing) return existing;

  const produtoInteresse = (order.items || []).map((i) => i.name).join(', ') || null;

  // Cria ou atualiza contato baseado no telefone
  let contatoId = null;
  const { data: contatoExistente } = await supabase
    .from('crm_contatos')
    .select('id')
    .eq('telefone', order.phone)
    .maybeSingle();

  if (contatoExistente) {
    contatoId = contatoExistente.id;
    await supabase
      .from('crm_contatos')
      .update({
        nome: order.name,
        produto_interesse: produtoInteresse,
        pedido_id: order.id,
        valor_potencial: order.value,
        ultima_interacao: new Date().toISOString(),
      })
      .eq('id', contatoId);
  } else {
    const { data: novoContato, error } = await supabase
      .from('crm_contatos')
      .insert([{
        nome: order.name,
        telefone: order.phone,
        origem: 'checkout',
        produto_interesse: produtoInteresse,
        pedido_id: order.id,
        valor_potencial: order.value,
        status: 'novo',
        prioridade: 'normal',
      }])
      .select()
      .single();
    if (error) throw error;
    contatoId = novoContato.id;
  }

  const ultimaMensagem = `Pedido #${order.order_number} — ${produtoInteresse || 'produto'} — R$ ${Number(order.value || 0).toFixed(2)}`;

  const { data: atendimento, error: atError } = await supabase
    .from('crm_atendimentos')
    .insert([{
      contato_id: contatoId,
      pedido_id: order.id,
      canal: 'whatsapp',
      status: 'novo',
      ultima_mensagem: ultimaMensagem,
    }])
    .select()
    .single();
  if (atError) throw atError;

  await supabase.from('crm_mensagens').insert([{
    atendimento_id: atendimento.id,
    direcao: 'loja',
    tipo: 'sistema',
    conteudo: ultimaMensagem,
  }]);

  return atendimento;
}
