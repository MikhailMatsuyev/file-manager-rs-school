// https://github.com/AlreadyBored/nodejs-assignments/blob/main/assignments/file-manager/assignment.md
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import { createBrotliCompress, createBrotliDecompress } from 'zlib';
import { createInterface } from 'readline';
import path from 'path';
import fs from 'fs';

let username = 'User';

// Функция-обертка для обработки ошибок
async function withErrorHandling(operation, operationName) {
    try {
        await operation();
    } catch (error) {
        console.error(`Operation ${operationName} failed: ${error.message}`);
    }
}

async function handleListFiles() {
    try {
        const files = await fs.promises.readdir(process.cwd(), { withFileTypes: true });

        // Создаем массив объектов с информацией о файлах и папках
        const fileList = files.map(file => ({
            Name: file.name,
            Type: file.isDirectory() ? 'directory' : 'file'
        }))
            // Сортируем: сначала папки, потом файлы, все в алфавитном порядке
            .sort((a, b) => {
                // Сначала сравниваем по типу (папки идут первыми)
                if (a.Type !== b.Type) {
                    return a.Type === 'directory' ? -1 : 1;
                }
                // Если тип одинаковый, сортируем по имени в алфавитном порядке
                return a.Name.localeCompare(b.Name);
            });

        // Выводим в виде таблицы для наглядности
        console.table(fileList);
    } catch (error) {
        throw new Error('FS operation failed');
    }
}

async function handleCompressFile(source, destination) {
    const fullSource = path.resolve(process.cwd(), source);
    const fullDestination = path.resolve(process.cwd(), destination);

    await fs.promises.access(fullSource);

    return new Promise((resolve, reject) => {
        const readStream = createReadStream(fullSource);
        const writeStream = createWriteStream(fullDestination);
        const brotli = createBrotliCompress();

        let totalBytes = 0;
        let compressedBytes = 0;

        readStream.on('data', (chunk) => {
            totalBytes += chunk.length;
        });

        writeStream.on('data', (chunk) => {
            compressedBytes += chunk.length;
        });

        readStream
            .pipe(brotli)
            .pipe(writeStream)
            .on('finish', () => {
                console.log(`Compress finished!`);
                console.log(`Original size: ${totalBytes} bytes`);
                console.log(`After compressing: ${compressedBytes} bytes`);
                resolve();
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

async function handleDecompressFile(source, destination) {
    const fullSource = path.resolve(process.cwd(), source);
    const fullDestination = path.resolve(process.cwd(), destination);

    try {
        await pipeline(
            createReadStream(fullSource),
            createBrotliDecompress(),
            createWriteStream(fullDestination)
        );
        console.log(`File decompressed from ${source} to ${destination}`);
    } catch (error) {
        throw error;
    }
}

async function handleCalculateHash(filePath) {
    const fullPath = path.resolve(process.cwd(), filePath);

    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(fullPath);

        stream.on('data', (chunk) => {
            hash.update(chunk);
        });

        stream.on('end', () => {
            const hexHash = hash.digest('hex');
            console.log(hexHash);
            resolve(hexHash);
        });

        stream.on('error', (error) => {
            reject(error);
        });
    });
}

async function handleReadFile(filePath) {
    const fullPath = path.resolve(process.cwd(), filePath);

    return new Promise((resolve, reject) => {
        const readStream = createReadStream(fullPath, 'utf8');

        readStream.on('data', (chunk) => {
            process.stdout.write(chunk);
        });

        readStream.on('end', () => {
            console.log('\n');
            resolve();
        });

        readStream.on('error', (error) => {
            reject(new Error('FS operation failed'));
        });
    });
}

// Обработка аргументов командной строки
function parseCommandLineArgs() {
    const args = process.argv.slice(2);

    for (const arg of args) {
        if (arg.startsWith('--username=')) {
            username = arg.split('=')[1];
        }
    }

    return args;
}

async function handleNavigateUp() {
    process.chdir('..');
    console.log(`Current directory: ${process.cwd()}`);
}

async function main() {
    const args = parseCommandLineArgs();
    console.log("==args===", args);

    // Если переданы аргументы команд (не только --username)
    const commandArgs = args.filter(arg => !arg.startsWith('--username'));
    console.log("=====", commandArgs);

    // Показываем приветствие
    console.log(`Welcome to the File Manager, ${username}!`);
    console.log(`You are currently in ${process.cwd()}`);
    console.log('Enter your commands (type "exit" to quit):');

    // Создаем интерфейс для чтения ввода
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> '
    });

    rl.prompt();

    rl.on('line', async (input) => {
        const trimmedInput = input.trim();
        const [command, ...params] = trimmedInput.split(' ');

        switch (command) {
            case 'ls':
                await withErrorHandling(handleListFiles, 'list files');
                break;
            case 'up':
                await withErrorHandling(handleNavigateUp, 'navigate up');
                break;
            case 'cd':
                if (params.length === 0) {
                    console.error('Path is required for cd command');
                } else {
                    await withErrorHandling(() => handleChangeDirectory(params[0]), 'change directory');
                }
                break;
            case 'cat':
                if (params.length === 0) {
                    console.error('File path is required for cat command');
                } else {
                    await withErrorHandling(() => handleReadFile(params[0]), 'read file');
                }
                break;
            case 'add':
                if (params.length === 0) {
                    console.error('File name is required for add command');
                } else {
                    await withErrorHandling(() => handleCreateFile(params[0]), 'create file');
                }
                break;
            case 'rn':
                if (params.length < 2) {
                    console.error('Both old path and new name are required for rn command');
                } else {
                    await withErrorHandling(() => handleRenameFile(params[0], params[1]), 'rename file');
                }
                break;
            case 'cp':
                if (params.length < 2) {
                    console.error('Both source and destination are required for cp command');
                } else {
                    await withErrorHandling(() => handleCopyFile(params[0], params[1]), 'copy file');
                }
                break;
            case 'mv':
                if (params.length < 2) {
                    console.error('Both source and destination are required for mv command');
                } else {
                    await withErrorHandling(() => handleMoveFile(params[0], params[1]), 'move file');
                }
                break;
            case 'rm':
                if (params.length === 0) {
                    console.error('File path is required for rm command');
                } else {
                    await withErrorHandling(() => handleRemoveFile(params[0]), 'remove file');
                }
                break;
            case 'os':
                if (params.length === 0) {
                    console.error('Flag is required for os command');
                } else {
                    await withErrorHandling(() => handleOperatingSystemInfo(params[0]), 'get OS info');
                }
                break;
            case 'hash':
                if (params.length === 0) {
                    console.error('File path is required for hash command');
                } else {
                    await withErrorHandling(() => handleCalculateHash(params[0]), 'calculate hash');
                }
                break;
            case 'compress':
                if (params.length < 2) {
                    console.error('Both source and destination are required for compress command');
                } else {
                    await withErrorHandling(() => handleCompressFile(params[0], params[1]), 'compress file');
                }
                break;
            case 'decompress':
                if (params.length < 2) {
                    console.error('Both source and destination are required for decompress command');
                } else {
                    await withErrorHandling(() => handleDecompressFile(params[0], params[1]), 'decompress file');
                }
                break;
            case '.exit':
            case 'exit':
                console.log(`Thank you for using File Manager, ${username}, goodbye!`);
                rl.close();
                return;
            default:
                console.log('Invalid input');
        }

        rl.prompt();
    });

    rl.on('close', () => {
        console.log(`Thank you for using File Manager, ${username}, goodbye!`);
        process.exit(0);
    });
}

// Запуск приложения
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});