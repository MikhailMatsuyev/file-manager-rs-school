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

// Основная функция с построчным вводом
async function main() {
    const args = parseCommandLineArgs();
    console.log("==args===", args)


    // Если переданы аргументы команд (не только --username)
    const commandArgs = args.filter(arg => !arg.startsWith('--username'));
    console.log("=====", commandArgs)
}

// Запуск приложения
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});