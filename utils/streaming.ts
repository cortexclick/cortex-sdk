import { Readable } from "stream";

export async function processStream(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder, contentStream: Readable, statusStream?: Readable): Promise<string> {
    let buffer = '';
    let fullContent = '';
    let isStatusStreamOpen = true;

    const processNextChunk = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
            contentStream.push(null);
            statusStream?.push(null);
            isStatusStreamOpen = false;
            return;
        }

        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split('\n');

        buffer = lines.pop() || '';

        for (let line of lines) {
            if (line.trim()) {
                try {
                    const json = JSON.parse(line);
                    // t is an abbreviation for "type"
                    // t:c = content
                    if (json.messageType === "content") {
                        if (isStatusStreamOpen) {
                            statusStream?.push(null);
                            isStatusStreamOpen = false;
                        }
                        
                        // m is the message
                        contentStream.push(json.message);
                        fullContent += json.message;
                    } 
                    // t:s = status message
                    else if (json.messageType === "status" && statusStream) {
                        statusStream.push(line + "\n");
                    }
                } catch (e) {
                    console.error('Error parsing JSON:', e);
                }
            }
        }

        await processNextChunk();
    };

    await processNextChunk().catch((error) => {
        contentStream.emit('error', error);
    });

    return fullContent;
}