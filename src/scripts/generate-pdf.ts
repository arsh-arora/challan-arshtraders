import React from 'react';
import { renderToStream, DocumentProps } from '@react-pdf/renderer';
import DeliveryChallanPDF from '../components/DeliveryChallanPDF';
import { Readable } from 'stream';

// Helper to read from stdin
async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
}

async function generate() {
    try {
        const input = await readStdin();
        if (!input) {
            throw new Error('No input provided');
        }

        const { doc, lines } = JSON.parse(input);

        // console.error('Generating PDF for doc:', doc.doc_no);
        // console.error('React version in worker:', React.version);

        const pdfElement = React.createElement(DeliveryChallanPDF, { doc, lines });
        const stream = await renderToStream(pdfElement as unknown as React.ReactElement<DocumentProps>);

        // Pipe stream to stdout
        const readable = stream as unknown as Readable;
        readable.pipe(process.stdout);

        // Handle errors on the stream
        readable.on('error', (err) => {
            console.error('Stream error:', err);
            process.exit(1);
        });

    } catch (error) {
        console.error('Error generating PDF:', error);
        process.exit(1);
    }
}

generate();
