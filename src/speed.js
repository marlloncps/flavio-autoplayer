// Experimento solicitado pelo usuário: única escrita permitida no estado do motor.
export function createSpeedControl(getPlayer) {
  const baseSpeed=getPlayer()?.speed;
  if(!Number.isFinite(baseSpeed)||baseSpeed<=0)throw new Error('Velocidade original inválida.');
  let multiplier=1;
  function setMultiplier(value){
    if(!Number.isFinite(value)||value<1||value>20)throw new Error('Escolha uma velocidade entre 1 e 20.');
    const player=getPlayer();
    if(!player||!Number.isFinite(player.speed)||player.speed<=0)throw new Error('Jogador indisponível para ajustar a velocidade.');
    player.speed=baseSpeed*value;multiplier=value;
    return player.speed;
  }
  return {baseSpeed,get multiplier(){return multiplier;},setMultiplier,reset:()=>setMultiplier(1)};
}
