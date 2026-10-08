import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {db} from "@/lib/db";
import {z} from "zod";

const levelSchema=z.enum(["L100","L200","L300","L400","L500","L600","POSTGRADUATE"]);
const genderSchema=z.enum(["Male","Female"]);
function csv(value:unknown){let text=value==null?"":value instanceof Date?value.toISOString():String(value);if(/^[=+\-@\t\r]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`}

import { resolveAdminSession } from "@/lib/access";

export async function GET(req:Request){
 const session = await resolveAdminSession(["SUPER_ADMIN","ADMIN"], undefined, req);
 if(!session?.user?.adminId||!["SUPER_ADMIN","ADMIN"].includes(session.user.role||""))return NextResponse.json({error:"Forbidden"},{status:403});
 const url=new URL(req.url),type=url.searchParams.get("type")||"members",from=url.searchParams.get("from"),to=url.searchParams.get("to"),sessionId=url.searchParams.get("sessionId"),rawGender=url.searchParams.get("gender"),rawLevel=url.searchParams.get("level");
 const gender=rawGender?genderSchema.safeParse(rawGender):null,level=rawLevel?levelSchema.safeParse(rawLevel):null;
 if((gender&&!gender.success)||(level&&!level.success))return NextResponse.json({error:"Invalid report filter."},{status:400});
 const dateRange={...(from?{gte:new Date(from)}:{}),...(to?{lte:new Date(to)}:{})};
 if((from&&Number.isNaN(Date.parse(from)))||(to&&Number.isNaN(Date.parse(to))))return NextResponse.json({error:"Invalid date filter."},{status:400});
 let lines:string[]=[];
 if(type==="attendance"){
  const records=await db.attendance.findMany({where:{...(sessionId?{sessionId}:{}),...(gender?.success||level?.success?{member:{...(gender?.success?{gender:gender.data}:{}),...(level?.success?{level:level.data}:{})}}:{}),checkedInAt:dateRange},include:{member:true,session:true},orderBy:{checkedInAt:"desc"}});
  lines=["Member ID,First Name,Last Name,Email,Phone,Session,Venue,Checked In At,Method",...records.map(a=>[a.member.memberId,a.member.firstName,a.member.lastName,a.member.email,a.member.phone,a.session.name,a.session.venue,a.checkedInAt,a.method].map(csv).join(","))];
 }else{
  const records=await db.member.findMany({where:{...(gender?.success?{gender:gender.data}:{}),...(level?.success?{level:level.data}:{}),createdAt:dateRange},orderBy:{createdAt:"desc"}});
  lines=["First Name,Last Name,Gender,Email,Phone,Residence,Level,Heard About,First Timer,Member ID,Date Registered",...records.map(m=>{const source=m.heardAbout?`${m.heardAbout}${m.heardAboutOther?` (${m.heardAboutOther})`:""}`:"";return[m.firstName,m.lastName,m.gender,m.email,m.phone,m.placeOfResidence,m.level,source,m.firstTimer?"Yes":"No",m.memberId,m.createdAt].map(csv).join(",")})];
 }
 await db.auditLog.create({data:{adminId:session.user.adminId,action:"DATA_EXPORTED",details:{type,from,to,sessionId,gender:gender?.success?gender.data:null,level:level?.success?level.data:null}}});
 return new NextResponse(lines.join("\r\n"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename=nifes-${type}.csv`}});
}
