// netlify/functions/file-api.mjs
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
    const store = getStore("truth-assets");
    const url = new URL(req.url);

    // [1] GET 요청: 방문자가 파일을 다운로드하거나 이미지를 볼 때
    if (req.method === "GET") {
        const fileName = url.searchParams.get("name");
        if (!fileName) return new Response("File not found", { status: 404 });

        const blob = await store.get(fileName, { type: "blob" });
        if (!blob) return new Response("File not found", { status: 404 });

        const headers = new Headers();
        headers.set("Content-Type", blob.type || "application/octet-stream");
        
        // 원본 파일명 추출 및 한글 깨짐 방지
        const originalName = fileName.substring(fileName.indexOf('_') + 1);
        const encodedFileName = encodeURIComponent(originalName);
        
        // inline: 이미지는 브라우저에서 보임 / attachment: 파일은 무조건 다운로드 됨
        const disposition = blob.type.startsWith('image/') ? 'inline' : 'attachment';
        headers.set("Content-Disposition", `${disposition}; filename*=UTF-8''${encodedFileName}`);

        return new Response(blob, { headers });
    }

    // [2] POST 요청: 관리자가 파일을 업로드할 때
    if (req.method === "POST") {
        try {
            const formData = await req.formData();
            const file = formData.get("file");
            
            if (!file) return new Response("No file uploaded", { status: 400 });

            // 중복 방지를 위한 고유 파일명 생성
            const fileName = `${Date.now()}_${file.name}`;
            
            // Netlify 저장소에 파일 저장
            await store.set(fileName, await file.arrayBuffer(), {
                metadata: { type: file.type }
            });

            // 다운로드 받을 수 있는 API 주소 생성
            const fileUrl = `/.netlify/functions/file-api?name=${encodeURIComponent(fileName)}`;

            return new Response(JSON.stringify({ url: fileUrl, fileName: file.name }), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
    }

    return new Response("Method Not Allowed", { status: 405 });
};