using System;
using System.Diagnostics;
using System.IO;
using System.Linq;

internal static class StlToBgsdLauncher
{
    private static int Main(string[] args)
    {
        bool pause = true;
        args = args.Where(arg =>
        {
            if (!String.Equals(arg, "--no-pause", StringComparison.OrdinalIgnoreCase)) return true;
            pause = false;
            return false;
        }).ToArray();

        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string scriptPath = Path.Combine(baseDir, "stl-to-bgsd.js");
        string outputDir = Path.Combine(baseDir, "my_designs");
        string combinedPath = Path.Combine(outputDir, "all-inserts.scad");

        Console.WriteLine("STL to BGSD");
        Console.WriteLine("Pasta: " + baseDir);
        Console.WriteLine();

        if (!File.Exists(scriptPath))
        {
            Console.Error.WriteLine("Nao encontrei stl-to-bgsd.js em:");
            Console.Error.WriteLine(scriptPath);
            WaitIfInteractive(pause);
            return 1;
        }

        string inputArgs = args.Length > 0
            ? string.Join(" ", args.Select(Quote))
            : Quote(Path.Combine(baseDir, "*.stl"));

        string nodeArgs =
            Quote(scriptPath) +
            " --combined " +
            Quote(combinedPath) +
            " " +
            inputArgs;

        int status = Run("node", nodeArgs, baseDir);
        Console.WriteLine();

        if (status == 0)
        {
            Console.WriteLine("Conversao finalizada.");
            Console.WriteLine("Arquivos gerados em:");
            Console.WriteLine(outputDir);
        }
        else
        {
            Console.WriteLine("A conversao terminou com erro: " + status);
        }

        WaitIfInteractive(pause);
        return status;
    }

    private static int Run(string fileName, string arguments, string workingDirectory)
    {
        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                WorkingDirectory = workingDirectory,
                UseShellExecute = false,
            };

            using (var process = Process.Start(startInfo))
            {
                if (process == null) return 1;
                process.WaitForExit();
                return process.ExitCode;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Nao foi possivel executar Node.js.");
            Console.Error.WriteLine(ex.Message);
            Console.Error.WriteLine();
            Console.Error.WriteLine("Confirme se o Node.js esta instalado e disponivel no PATH.");
            return 1;
        }
    }

    private static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }

    private static void WaitIfInteractive(bool pause)
    {
        if (!pause || !Environment.UserInteractive) return;
        Console.WriteLine();
        Console.WriteLine("Pressione Enter para fechar.");
        Console.ReadLine();
    }
}
