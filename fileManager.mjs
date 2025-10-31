// https://github.com/AlreadyBored/nodejs-assignments/blob/main/assignments/file-manager/assignment.md
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import { createBrotliCompress, createBrotliDecompress } from 'zlib';
import { createInterface } from 'readline';
import { homedir, EOL, arch, cpus, userInfo } from 'os';
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

        // Создаем массив объектов с инфой о файлах и папках
        const fileList = files.map(file => ({
            Name: file.name,
            Type: file.isDirectory() ? 'directory' : 'file'
        }))
            // Сортируем: сначала папки, потом файлы, все по алфавиту
            .sort((a, b) => {
                // Сначала сравниваем по типу (папки идут первыми)
                if (a.Type !== b.Type) {
                    return a.Type === 'directory' ? -1 : 1;
                }
                // Если тип одинаковый, сортируем по имени в алфавитном порядке
                return a.Name.localeCompare(b.Name);
            });

        // Выводим в виде таблицы
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

async function handleChangeDirectory(newPath) {
    const targetPath = path.resolve(process.cwd(), newPath);
    await fs.promises.access(targetPath);
    process.chdir(targetPath);
    console.log(`Current directory: ${process.cwd()}`);
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

async function handleCreateFile(fileName) {
    const filePath = path.resolve(process.cwd(), fileName);
    await fs.promises.writeFile(filePath, '');
    console.log(`File ${fileName} was created`);
}

async function handleRenameFile(oldPath, newName) {
    const fullOldPath = path.resolve(process.cwd(), oldPath);
    const fullNewPath = path.resolve(process.cwd(), newName);

    await fs.promises.access(fullOldPath);
    await fs.promises.rename(fullOldPath, fullNewPath);
    console.log(`File was renamed from ${oldPath} to ${newName}`);
}

async function handleCopyFile(source, destination) {
    const fullSource = path.resolve(process.cwd(), source);
    const fullDestination = path.resolve(process.cwd(), destination);

    await fs.promises.access(fullSource);

    const readStream = createReadStream(fullSource);
    const writeStream = createWriteStream(fullDestination);

    await pipeline(readStream, writeStream);
    console.log(`File was copied from ${source} to ${destination}`);
}

async function handleMoveFile(source, destination) {
    const fullSource = path.resolve(process.cwd(), source);
    const fullDestination = path.resolve(process.cwd(), destination);

    await fs.promises.access(fullSource);
    await fs.promises.rename(fullSource, fullDestination);
    console.log(`File was moved from ${source} to ${destination}`);
}

async function handleRemoveFile(filePath) {
    const fullPath = path.resolve(process.cwd(), filePath);
    await fs.promises.unlink(fullPath);
    console.log(`File ${filePath} was deleted`);
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
    const currentDir = process.cwd();

    // Проверяем, не находимся ли мы уже в корневой директории
    if (currentDir === path.parse(currentDir).root) {
        console.log('You are already in the root directory');
        return;
    }

    try {
        process.chdir('..');
        console.log(`Current directory: ${process.cwd()}`);
    } catch (error) {
        throw new Error('FS operation failed');
    }
}

async function handleOperatingSystemInfo(flag) {
    switch (flag) {
        case '--EOL':
            console.log(JSON.stringify(EOL));
            break;
        case '--cpus':
            const cpusInfo = cpus();
            console.log(`Total CPUs: ${cpusInfo.length}`);
            cpusInfo.forEach((cpu, index) => {
                console.log(`CPU ${index + 1}: ${cpu.model} (${cpu.speed / 1000} GHz)`);
            });
            break;
        case '--homedir':
            console.log(homedir());
            break;
        case '--username':
            console.log(userInfo().username);
            break;
        case '--architecture':
            console.log(arch());
            break;
        default:
            console.log('Invalid OS flag');
    }
}

// Функция для вывода справки по командам
async function handleHelp() {
    const commands = [
        { command: 'ls', description: 'List files and directories in current directory', example: 'ls' },
        { command: 'up', description: 'Navigate to parent directory', example: 'up' },
        { command: 'cd <path>', description: 'Change current directory', example: 'cd ./folder' },
        { command: 'cat <path>', description: 'Read file and print its content', example: 'cat file.txt' },
        { command: 'add <filename>', description: 'Create new file', example: 'add newfile.txt' },
        { command: 'rn <path> <newName>', description: 'Rename file or directory', example: 'rn old.txt new.txt' },
        { command: 'cp <source> <destination>', description: 'Copy file', example: 'cp file.txt copy.txt' },
        { command: 'mv <source> <destination>', description: 'Move file', example: 'mv file.txt ./folder/' },
        { command: 'rm <path>', description: 'Remove file', example: 'rm file.txt' },
        { command: 'os --<flag>', description: 'Get system information (--EOL, --cpus, --homedir, --username, --architecture)', example: 'os --cpus' },
        { command: 'hash <path>', description: 'Calculate file hash (SHA256)', example: 'hash file.txt' },
        { command: 'compress <source> <destination>', description: 'Compress file using Brotli', example: 'compress file.txt ./compressed/' },
        { command: 'decompress <source> <destination>', description: 'Decompress Brotli compressed file', example: 'decompress file.txt.br ./decompressed/' },
        { command: 'help', description: 'Show this help message', example: 'help' },
        { command: 'exit', description: 'Exit file manager', example: 'exit' }
    ];

    console.log('\nAvailable commands:');
    console.log('==================\n');

    commands.forEach(cmd => {
        console.log(`Command: ${cmd.command}`);
        console.log(`Description: ${cmd.description}`);
        console.log(`Example: ${cmd.example}`);
        console.log('---');
    });
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
            /**/ case 'ls':
                await withErrorHandling(handleListFiles, 'list files'); // +
                break;
            /**/ case 'up':
                await withErrorHandling(handleNavigateUp, 'navigate up'); // +
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
            /*+*/case 'os':
                if (params.length === 0) {
                    console.error('Flag is required for os command');
                } else {
                    await withErrorHandling(() => handleOperatingSystemInfo(params[0]), 'get OS info');
                }
                break;
            case 'hash': //+
                if (params.length === 0) {
                    console.error('File path is required for hash command');
                } else {
                    await withErrorHandling(() => handleCalculateHash(params[0]), 'calculate hash');
                }
                break;
            case 'compress': // + compress new_file.txt compressed_file.br
                if (params.length < 2) {
                    console.error('Both source and destination are required for compress command');
                } else {
                    await withErrorHandling(() => handleCompressFile(params[0], params[1]), 'compress file');
                }
                break;
            case 'decompress': // + decompress compressed_file.br del.txt
                if (params.length < 2) {
                    console.error('Both source and destination are required for decompress command');
                } else {
                    await withErrorHandling(() => handleDecompressFile(params[0], params[1]), 'decompress file');
                }
                break;
            case 'handleHelp':
                await withErrorHandling(handleHelp, 'list commands'); // +
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
    console.error('Error:', error);
    process.exit(1);
});