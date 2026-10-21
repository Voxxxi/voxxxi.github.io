import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(async (req: Request) => {
 if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405});
 const token=Deno.env.get("TELEGRAM_BOT_TOKEN"),webhookSecret=Deno.env.get("VOXI_WEBHOOK_SECRET");
 if(!token||!webhookSecret)return Response.json({error:"Server secrets are not configured"},{status:500});
 if(req.headers.get("x-voxi-secret")!==webhookSecret)return Response.json({error:"Unauthorized"},{status:401});
 let booking: Record<string, unknown>;
 try{booking=await req.json();if(!booking||typeof booking!=="object"||Array.isArray(booking))throw Error();}
 catch{return Response.json({error:"Invalid JSON body"},{status:400});}
 const message=booking.event==="registration"
 ?["👤 VOXi — новый пользователь завершил регистрацию.","Откройте карточку клиента в админке:","https://voxxxi.github.io/admin.html?section=home#newRegistrations"].join("\n")
 :[
 "🎙️ VOXi — новая запись!","",
 `👤 Клиент: ${booking.client_name ?? "Не указано"}`,
 `📞 Телефон: ${booking.phone ?? "Не указан"}`,
 `📅 Дата: ${booking.booking_date ?? "Не указана"}`,
 `🕒 Время: ${booking.booking_time ?? "Не указано"}`,
 `👥 Человек: ${booking.people_count ?? "Не указано"}`,
 `🎵 Количество песен: ${booking.song_count ?? "Не указано"}`,
 `🎶 Названия песен: ${booking.song_titles ?? "Не указаны"}`,
 `💰 Стоимость: ${booking.price ?? "Не указана"} ₸`
 ].join("\n");
 let telegramResponse: Response;
 try{
  telegramResponse=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({chat_id:"625258450",text:message}),
   signal:AbortSignal.timeout(10000)
  });
 }catch{return Response.json({error:"Telegram could not send the message"},{status:502});}
 if(!telegramResponse.ok)return Response.json({error:"Telegram could not send the message"},{status:502});
 return Response.json({success:true});
});

